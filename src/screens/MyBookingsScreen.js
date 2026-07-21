import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  Modal,
  TextInput,
  Share,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import { getBookingsByUser, cancelBooking, getCurrentUser, addReview, getReviews } from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticWarning } from '../utils/haptics';

export default function MyBookingsScreen({ navigation }) {
  const { colors } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [ratedBookings, setRatedBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const animateList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const loadBookings = async () => {
    const user = await getCurrentUser();
    if (user) {
      setUser(user);
      const data = await getBookingsByUser(user.id);
      setBookings(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      const allReviews = await getReviews();
      const rated = allReviews.filter((r) => r.userId === user.id).map((r) => r.serviceId);
      setRatedBookings(rated);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const handleCancel = (booking) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
          onPress: async () => {
            await cancelBooking(booking.id);
            animateList();
            loadBookings();
        },
      },
    ]);
  };

  const callBusiness = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openRateModal = (booking) => {
    setSelectedBooking(booking);
    setRating(5);
    setReviewText('');
    setShowRateModal(true);
  };

  const submitRating = async () => {
    if (!selectedBooking) return;
    const review = {
      id: 'review_' + Date.now(),
      serviceId: selectedBooking.businessId,
      userId: user?.id,
      userName: user?.name || 'Guest',
      rating,
      text: reviewText.trim() || 'Great service!',
      date: new Date().toISOString(),
    };
    await addReview(review);
    setShowRateModal(false);
    Alert.alert('Thanks!', 'Your review has been submitted.');
    loadBookings();
  };

  const shareReceipt = (booking) => {
    const message = `Nadma Booking Receipt\n\nProvider: ${booking.businessName}\nDate: ${booking.date}\nTime: ${booking.time}\nStatus: ${booking.status.toUpperCase()}\n\nBooked via Nadma - Nampundwe Services`;
    Share.share({ message, title: 'Booking Receipt' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#999';
    }
  };

  const getStatusMessage = (status) => {
    switch (status) {
      case 'pending':
        return 'Waiting for admin approval';
      case 'approved':
        return 'Approved! You can now call the business';
      case 'rejected':
        return 'Booking was rejected by admin';
      case 'completed':
        return 'Service completed';
      case 'cancelled':
        return 'Booking cancelled';
      default:
        return '';
    }
  };

  const filteredBookings =
    filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const styles = getStyles(colors);

  const renderBooking = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.businessName}>{item.businessName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.statusMessage}>{getStatusMessage(item.status)}</Text>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>{item.date}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#666" />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="alert-circle" size={16} color="#666" />
          <Text style={styles.detailText}>{item.urgency} priority</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
      </View>

      <View style={styles.cardActions}>
        {item.status === 'pending' && (
          <>
            <TouchableOpacity style={styles.callButton} onPress={() => callBusiness(item.businessPhone)}>
              <Ionicons name="call" size={16} color="#4CAF50" />
              <Text style={styles.callText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { hapticWarning(); handleCancel(item); }}>
              <Ionicons name="close-circle" size={16} color="#F44336" />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'approved' && (
          <TouchableOpacity style={styles.callButton} onPress={() => callBusiness(item.businessPhone)}>
            <Ionicons name="call" size={16} color="#4CAF50" />
            <Text style={styles.callText}>Call Business</Text>
          </TouchableOpacity>
        )}
        {item.status === 'completed' && !ratedBookings.includes(item.businessId) && (
          <TouchableOpacity style={styles.rateButton} onPress={() => { hapticLight(); openRateModal(item); }}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.rateText}>Rate Service</Text>
          </TouchableOpacity>
        )}
        {item.status === 'completed' && ratedBookings.includes(item.businessId) && (
          <View style={styles.ratedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.ratedText}>Rated</Text>
          </View>
        )}
        <TouchableOpacity style={styles.shareReceiptBtn} onPress={() => shareReceipt(item)}>
          <Ionicons name="receipt-outline" size={16} color="#1a237e" />
          <Text style={styles.shareReceiptText}>Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterBar}>
        {['all', 'pending', 'approved', 'completed', 'rejected'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.activeFilter]}
            onPress={() => { hapticLight(); animateList(); setFilter(f); }}
          >
            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredBookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No bookings yet</Text>
            <Text style={styles.emptySubtext}>
              Book a service to get started
            </Text>
          </View>
        }
      />
      {/* Rate Modal */}
      <Modal visible={showRateModal} transparent animationType="slide" onRequestClose={() => setShowRateModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowRateModal(false)}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              Rate {selectedBooking?.businessName}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' }}>How was your experience?</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={40} color="#FFD700" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={{ backgroundColor: colors.inputBg, borderRadius: 14, padding: 16, fontSize: 15, color: colors.text, height: 100, marginBottom: 20, borderWidth: 1.5, borderColor: colors.border }}
              placeholder="Share your experience (optional)..."
              placeholderTextColor={colors.textMuted}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.borderLight }} onPress={() => setShowRateModal(false)}>
                <Text style={{ fontSize: 15, color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#1a237e' }} onPress={submitRating}>
                <Text style={{ fontSize: 15, color: '#fff', fontWeight: '600' }}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 2,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  activeFilter: {
    backgroundColor: '#1a237e',
  },
  filterText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  statusMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: 12,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  callText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  ratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratedText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  shareReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  shareReceiptText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#1a237e',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
});
