import React, { useState, useEffect } from 'react';
import {
  View,
  Text,

  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getRegisteredBusinesses,
  getBookingsByBusiness,
  updateBookingStatus,
  getCurrentUser,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { createStyleSheet } from '../utils/responsive';

export default function BookingsManagerScreen({ navigation }) {
  const { colors } = useTheme();
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    const user = await getCurrentUser();
    if (user) {
      const all = await getRegisteredBusinesses();
      const mine = all.filter((b) => b.ownerId === user.id);
      setBusinesses(mine);
      if (mine.length === 1) {
        setSelectedBusiness(mine[0]);
        loadBookings(mine[0].id);
      }
    }
    setLoading(false);
  };

  const loadBookings = async (businessId) => {
    const data = await getBookingsByBusiness(businessId);
    setBookings(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  };

  const handleStatusUpdate = (booking, status) => {
    const labels = {
      confirmed: 'Confirm',
      completed: 'Mark Completed',
      cancelled: 'Reject',
    };
    Alert.alert(
      `${labels[status]} Booking`,
      `Update this booking to "${status}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            await updateBookingStatus(booking.id, status);
            loadBookings(selectedBusiness.id);
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#999';
    }
  };

  const filteredBookings =
    filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const styles = getStyles(colors);

  const renderBooking = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.userEmail}>{item.userEmail}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>{item.date} at {item.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="alert-circle" size={16} color="#666" />
          <Text style={styles.detailText}>{item.urgency} priority</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => Linking.openURL(`tel:${item.businessPhone}`)}
        >
          <Ionicons name="call" size={16} color="#4CAF50" />
          <Text style={styles.callText}>Call Customer</Text>
        </TouchableOpacity>

        {item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => handleStatusUpdate(item, 'confirmed')}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleStatusUpdate(item, 'cancelled')}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'confirmed' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleStatusUpdate(item, 'completed')}
          >
            <Text style={styles.completeText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
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

  if (businesses.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="storefront-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No businesses registered</Text>
          <Text style={styles.emptySubtext}>
            Register a business first to manage bookings
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {businesses.length > 1 && !selectedBusiness && (
        <View style={styles.businessSelector}>
          <Text style={styles.selectorTitle}>Select a business:</Text>
          {businesses.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={styles.businessOption}
              onPress={() => {
                setSelectedBusiness(b);
                loadBookings(b.id);
              }}
            >
              <Ionicons name="storefront" size={20} color="#1a237e" />
              <Text style={styles.businessOptionText}>{b.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedBusiness && (
        <>
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>{selectedBusiness.name}</Text>
            {businesses.length > 1 && (
              <TouchableOpacity onPress={() => setSelectedBusiness(null)}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterBar}>
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.activeFilter]}
                onPress={() => setFilter(f)}
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="clipboard-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No bookings</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>No bookings match this filter</Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  businessSelector: {
    padding: 16,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  businessOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  businessOptionText: {
    marginLeft: 12,
    fontSize: 16,
    color: colors.text,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  changeText: {
    fontSize: 14,
    color: '#1a237e',
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 2,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginHorizontal: 3,
  },
  activeFilter: {
    backgroundColor: '#1a237e',
  },
  filterText: {
    fontSize: 11,
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
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  confirmButton: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44336',
  },
  completeButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
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
