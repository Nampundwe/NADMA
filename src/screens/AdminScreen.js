import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import {
  getAllUsers,
  onUsersSnapshot,
  banUser,
  unbanUser,
  deleteUser,
  getRegisteredBusinesses,
  deleteBusiness,
  approveBusiness,
  rejectBusiness,
  getAllReviews,
  deleteReview,
  updateBookingStatus,
  getAdminAnalytics,
  onAdminAnalyticsSnapshot,
  getAllReports,
  deleteReport,
  onBookingsSnapshot,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { hapticLight, hapticSuccess, hapticWarning } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';

export default function AdminScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('bookings');
  const [users, setUsers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const unsubBookings = onBookingsSnapshot((bookings) => {
      setBookings(bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
    const unsubUsers = onUsersSnapshot((users) => {
      setUsers(users);
      setLoading(false);
    });
    const unsubAnalytics = onAdminAnalyticsSnapshot((a) => {
      setAnalytics(a);
    });
    return () => { unsubBookings(); unsubUsers(); unsubAnalytics(); };
  }, []);

  const animateList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const loadData = async () => {
    try {
      const u = await getAllUsers();
      console.log('[Admin loadData] users:', u.length);
      const b = await getRegisteredBusinesses();
      const r = await getAllReviews();
      const a = await getAdminAnalytics();
      const rp = await getAllReports();
      setUsers(u || []);
      setBusinesses(b || []);
      setReviews(r || []);
      setAnalytics(a || {});
      setReports(rp || []);
    } catch (e) {
      console.log('[Admin loadData] ERROR:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const approvedBookings = bookings.filter((b) => b.status === 'approved');
  const pendingBusinesses = businesses.filter((b) => b.approvalStatus === 'pending');

  const handleApproveBooking = (booking) => {
    Alert.alert('Approve Booking', `Approve booking by ${booking.userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          await updateBookingStatus(booking.id, 'approved');
          hapticSuccess();
          animateList();
          loadData();
        },
      },
    ]);
  };

  const handleRejectBooking = (booking) => {
    Alert.alert('Reject Booking', `Reject booking by ${booking.userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          await updateBookingStatus(booking.id, 'rejected');
          hapticWarning();
          animateList();
          loadData();
        },
      },
    ]);
  };

  const handleCompleteBooking = async (booking) => {
    animateList();
    await updateBookingStatus(booking.id, 'completed');
    loadData();
  };

  const handleBanUser = (user) => {
    Alert.alert('Ban User', `Ban ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: async () => { await banUser(user.id); animateList(); loadData(); },
      },
    ]);
  };

  const handleDeleteUser = (user) => {
    Alert.alert('Delete User', `Delete ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteUser(user.id); animateList(); loadData(); },
      },
    ]);
  };

  const handleApproveBusiness = async (business) => {
    animateList();
    await approveBusiness(business.id);
    loadData();
    Alert.alert('Approved', `${business.name} is now visible to users.`);
  };

  const handleRejectBusiness = (business) => {
    Alert.alert('Reject', `Reject "${business.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => { await rejectBusiness(business.id); animateList(); loadData(); },
      },
    ]);
  };

  const handleDeleteBusiness = (business) => {
    Alert.alert('Delete', `Delete "${business.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteBusiness(business.id); animateList(); loadData(); },
      },
    ]);
  };

  const handleDeleteReview = (review) => {
    Alert.alert('Delete Review', 'Delete this review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteReview(review.id); animateList(); loadData(); },
      },
    ]);
  };

  const toggleBookingSelection = (id) => {
    setSelectedBookings((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const bulkApprove = async () => {
    if (selectedBookings.length === 0) return;
    Alert.alert('Bulk Approve', `Approve ${selectedBookings.length} booking(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve All',
        onPress: async () => {
          for (const id of selectedBookings) {
            await updateBookingStatus(id, 'approved');
          }
          hapticSuccess();
          setSelectedBookings([]);
          setSelectMode(false);
          loadData();
        },
      },
    ]);
  };

  const bulkReject = async () => {
    if (selectedBookings.length === 0) return;
    Alert.alert('Bulk Reject', `Reject ${selectedBookings.length} booking(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject All',
        style: 'destructive',
        onPress: async () => {
          for (const id of selectedBookings) {
            await updateBookingStatus(id, 'rejected');
          }
          hapticWarning();
          setSelectedBookings([]);
          setSelectMode(false);
          loadData();
        },
      },
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': case 'completed': return colors.success;
      case 'pending': return colors.warning;
      case 'rejected': case 'cancelled': return colors.danger;
      default: return colors.textSecondary;
    }
  };

  const renderBooking = ({ item }) => (
    <View style={[styles.card, selectMode && selectedBookings.includes(item.id) && { borderColor: colors.primary, borderWidth: 2 }]}>
      {selectMode && (
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }} onPress={() => toggleBookingSelection(item.id)}>
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selectedBookings.includes(item.id) ? colors.primary : colors.border, backgroundColor: selectedBookings.includes(item.id) ? colors.primary : colors.card, justifyContent: 'center', alignItems: 'center' }}>
            {selectedBookings.includes(item.id) && <Ionicons name="check" size={16} color="#fff" />}
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Select this booking</Text>
        </TouchableOpacity>
      )}
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.businessName}</Text>
          <Text style={styles.cardSubtitle}>Booked by: {item.userName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{item.date} at {item.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="phone" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{item.userEmail}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="alert-circle" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{item.urgency} priority</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
      </View>
      <View style={styles.cardActions}>
        {item.status === 'pending' && (
          <>
            <TouchableOpacity style={styles.approveButton} onPress={() => handleApproveBooking(item)}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectBooking(item)}>
              <Ionicons name="close-circle" size={18} color={colors.danger} />
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'approved' && (
          <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteBooking(item)}>
            <Ionicons name="checkmark-done" size={18} color={colors.info} />
            <Text style={styles.completeText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => navigation.navigate('Chat', { receiverId: item.userId, receiverName: item.userName, conversationType: 'user' })}
        >
          <Ionicons name="chat" size={18} color={colors.primary} />
          <Text style={[styles.callText, { color: colors.primary }]}>Message User</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => Linking.openURL(`tel:${item.businessPhone}`)}
        >
          <Ionicons name="phone" size={18} color={colors.textSecondary} />
          <Text style={styles.callText}>Call Business</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBusiness = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.category} - {item.address}</Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.approvalStatus === 'approved' ? colors.success :
            item.approvalStatus === 'rejected' ? colors.danger : colors.warning
        }]}>
          <Text style={styles.statusText}>{item.approvalStatus}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        {item.approvalStatus === 'pending' && (
          <>
            <TouchableOpacity style={styles.approveButton} onPress={() => handleApproveBusiness(item)}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectBusiness(item)}>
              <Ionicons name="close-circle" size={18} color={colors.danger} />
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteBusiness(item)}>
          <Ionicons name="trash" size={18} color={colors.textSecondary} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUser = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: item.role === 'admin' ? colors.danger : item.role === 'provider' ? colors.success : colors.info }]}>
          <Text style={styles.roleBadgeText}>{item.role}</Text>
        </View>
      </View>
      {item.banned && (
        <View style={styles.bannedBadge}><Text style={styles.bannedText}>BANNED</Text></View>
      )}
      <View style={styles.cardActions}>
        {item.banned ? (
          <TouchableOpacity style={styles.unbanButton} onPress={() => { animateList(); unbanUser(item.id).then(loadData); }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.unbanText}>Unban</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.banButton} onPress={() => handleBanUser(item)}>
            <Ionicons name="block" size={18} color={colors.danger} />
            <Text style={styles.banText}>Ban</Text>
          </TouchableOpacity>
        )}
        {item.role !== 'admin' && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => navigation.navigate('Chat', { receiverId: item.id, receiverName: item.name, conversationType: 'user' })}
          >
            <Ionicons name="chat" size={18} color={colors.primary} />
            <Text style={[styles.callText, { color: colors.primary }]}>Message</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteUser(item)}>
          <Ionicons name="trash" size={18} color={colors.textSecondary} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReview = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <View style={styles.reviewRating}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons key={star} name={star <= item.rating ? 'star' : 'star-outline'} size={14} color={colors.warning} />
            ))}
          </View>
          <Text style={styles.reviewText} numberOfLines={2}>{item.text}</Text>
          <Text style={styles.cardSubtitle}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteReview(item)}>
          <Ionicons name="trash" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const tabs = [
    { key: 'analytics', label: 'Analytics' },
    { key: 'bookings', label: `Bookings (${pendingBookings.length})` },
    { key: 'businesses', label: `Businesses (${pendingBusinesses.length})` },
    { key: 'users', label: `Users (${users.length})` },
    { key: 'reviews', label: `Reviews (${reviews.length})` },
    { key: 'reports', label: `Reports (${reports.length})` },
  ];

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Admin Panel</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => { hapticLight(); setActiveTab(tab.key); }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'analytics' && analytics && (
        <ScrollView
          contentContainerStyle={styles.analyticsContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          <Text style={styles.analyticsTitle}>Platform Overview</Text>
          <View style={styles.analyticsGrid}>
            {[
              { label: 'Total Users', value: analytics.totalUsers, icon: 'people', color: colors.info },
              { label: 'Total Bookings', value: analytics.totalBookings, icon: 'event', color: colors.success },
              { label: 'This Week', value: analytics.weekBookings, icon: 'trending-up', color: colors.warning },
              { label: 'Completed', value: analytics.completedBookings, icon: 'done-all', color: colors.purple },
              { label: 'Pending', value: analytics.pendingBookings, icon: 'schedule', color: colors.danger },
              { label: 'Providers', value: analytics.totalProviders, icon: 'work', color: colors.info },
              { label: 'Businesses', value: analytics.totalBusinesses, icon: 'store', color: colors.textSecondary },
              { label: 'Avg Rating', value: analytics.avgRating, icon: 'star', color: colors.warning },
              { label: 'Total Reviews', value: analytics.totalReviews, icon: 'chat', color: colors.danger },
            ].map((item, idx) => (
              <View key={idx} style={styles.analyticsCard}>
                <View style={[styles.analyticsIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.analyticsValue}>{item.value}</Text>
                <Text style={styles.analyticsLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Bookings by Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8, paddingVertical: 16 }}>
              {[
                { label: 'Pending', count: pendingBookings.length, color: colors.warning },
                { label: 'Approved', count: approvedBookings.length, color: colors.success },
                { label: 'Completed', count: bookings.filter(b => b.status === 'completed').length, color: colors.info },
                { label: 'Rejected', count: bookings.filter(b => b.status === 'rejected').length, color: colors.danger },
              ].map((item, i) => {
                const max = Math.max(pendingBookings.length, approvedBookings.length, bookings.filter(b => b.status === 'completed').length, bookings.filter(b => b.status === 'rejected').length, 1);
                const height = (item.count / max) * 80;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: item.color }}>{item.count}</Text>
                    <View style={{ width: '100%', height: Math.max(height, 4), backgroundColor: item.color, borderRadius: 6, marginTop: 4 }} />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Bookings Trend (7 Days)</Text>
            {(() => {
              const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const dateStr = d.toISOString().split('T')[0];
                const count = bookings.filter(b => b.createdAt && b.createdAt.startsWith(dateStr)).length;
                return { day: d.toLocaleDateString('en', { weekday: 'short' }), count };
              });
              const maxDay = Math.max(...last7Days.map(d => d.count), 1);
              return (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6, paddingVertical: 16 }}>
                  {last7Days.map((item, i) => {
                    const height = (item.count / maxDay) * 80;
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{item.count}</Text>
                        <View style={{ width: '80%', height: Math.max(height, 4), backgroundColor: colors.primary, borderRadius: 6, marginTop: 4 }} />
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>{item.day}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Category Distribution</Text>
            {(() => {
              const categoryCounts = {};
              businesses.forEach(p => {
                const cat = p.category || 'Other';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
              });
              const sorted = Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6);
              const maxCat = Math.max(...sorted.map(([, c]) => c), 1);
              const catColors = [colors.info, colors.success, colors.warning, colors.purple, colors.danger, colors.info];
              return sorted.length === 0 ? (
                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>No category data</Text>
              ) : (
                sorted.map(([cat, count], i) => (
                  <View key={cat} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.text }}>{cat}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: catColors[i % catColors.length] }}>{count}</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden' }}>
                      <View style={{ width: `${(count / maxCat) * 100}%`, height: '100%', backgroundColor: catColors[i % catColors.length], borderRadius: 4 }} />
                    </View>
                  </View>
                ))
              );
            })()}
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Rating Distribution</Text>
            {(() => {
              const ratingCounts = [0, 0, 0, 0, 0];
              reviews.forEach(r => {
                if (r.rating >= 1 && r.rating <= 5) ratingCounts[r.rating - 1]++;
              });
              const maxRating = Math.max(...ratingCounts, 1);
              const barColors = [colors.danger, colors.warning, colors.warning, colors.success, colors.success];
              return [5, 4, 3, 2, 1].map(star => {
                const idx = star - 1;
                const count = ratingCounts[idx];
                return (
                  <View key={star} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', width: 70 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Ionicons key={s} name={s <= star ? 'star' : 'star-outline'} size={12} color={colors.warning} />
                      ))}
                    </View>
                    <View style={{ flex: 1, height: 10, backgroundColor: colors.borderLight, borderRadius: 5, marginHorizontal: 8, overflow: 'hidden' }}>
                      <View style={{ width: `${(count / maxRating) * 100}%`, height: '100%', backgroundColor: barColors[idx], borderRadius: 5 }} />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, width: 30, textAlign: 'right' }}>{count}</Text>
                  </View>
                );
              });
            })()}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {activeTab === 'bookings' && (
        <>
          {pendingBookings.length > 0 && (
            <View style={styles.bulkBar}>
              <TouchableOpacity
                style={[styles.bulkBtn, selectMode && styles.bulkBtnActive]}
                onPress={() => { setSelectMode(!selectMode); setSelectedBookings([]); }}
              >
                <Text style={[styles.bulkBtnText, selectMode && styles.bulkBtnTextActive]}>
                  {selectMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
              {selectMode && selectedBookings.length > 0 && (
                <>
                  <TouchableOpacity style={styles.bulkApproveBtn} onPress={bulkApprove}>
                    <Ionicons name="checkmark-done" size={18} color={colors.success} />
                    <Text style={styles.bulkApproveText}>Approve ({selectedBookings.length})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bulkRejectBtn} onPress={bulkReject}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                    <Text style={styles.bulkRejectText}>Reject ({selectedBookings.length})</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          <FlatList
            data={bookings}
            renderItem={renderBooking}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="calendar" size={36} color={colors.textMuted} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No bookings</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>No bookings have been made yet</Text>
              </View>
            }
          />
        </>
      )}

      {activeTab === 'businesses' && (
        <FlatList
          data={businesses}
          renderItem={renderBusiness}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="storefront" size={36} color={colors.textMuted} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No businesses</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>No businesses registered yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'users' && (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No users</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>No users registered yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'reviews' && (
        <FlatList
          data={reviews}
          renderItem={renderReview}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="star-border" size={36} color={colors.textMuted} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No reviews</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>No reviews submitted yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'reports' && (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{item.providerName}</Text>
                  <Text style={styles.cardSubtitle}>Reported by: {item.reporterName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.statusText}>{item.category}</Text>
                </View>
              </View>
              <Text style={styles.description}>{item.reason}</Text>
              <Text style={styles.cardSubtitle}>{new Date(item.timestamp).toLocaleString()}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.deleteButton} onPress={async () => { animateList(); await deleteReport(item.id); loadData(); }}>
                  <Ionicons name="trash" size={18} color={colors.danger} />
                  <Text style={[styles.deleteText, { color: colors.danger }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="flag" size={36} color={colors.textMuted} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>No reports</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>No reports have been submitted</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabBar: {
    backgroundColor: colors.card,
    elevation: 2,
    maxHeight: 50,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardBody: {
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 13,
    color: colors.textSecondary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  bannedBadge: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  bannedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.danger,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 12,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  approveText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.info,
    fontWeight: '600',
  },
  banButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  banText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
  unbanButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unbanText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  reviewRating: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 40,
  },
  analyticsContainer: {
    padding: 16,
  },
  analyticsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsCard: {
    width: '31%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    elevation: 2,
  },
  analyticsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  analyticsValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  analyticsLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  bulkBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
  },
  bulkBtnActive: {
    backgroundColor: colors.primary,
  },
  bulkBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  bulkBtnTextActive: {
    color: '#fff',
  },
  bulkApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.successLight,
    gap: 4,
  },
  bulkApproveText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  bulkRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.dangerLight,
    gap: 4,
  },
  bulkRejectText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
});
