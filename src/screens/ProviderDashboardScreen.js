import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getCurrentUser,
  getBookingsByBusiness,
  getReviews,
  getProviderStats,
  getProviderByOwnerId,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { createStyleSheet } from '../utils/responsive';

const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#10B981',
  completed: '#3B82F6',
  rejected: '#EF4444',
};

export default function ProviderDashboardScreen({ route, navigation }) {
  const { colors } = useTheme();
  const routeProviderId = route.params?.providerId;
  const routeProviderName = route.params?.providerName;

  const [providerId, setProviderId] = useState(routeProviderId || null);
  const [providerName, setProviderName] = useState(routeProviderName || '');
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [providerId])
  );

  const loadDashboard = async () => {
    setLoading(true);
    try {
      let pid = providerId;
      let pname = providerName;
      if (!pid) {
        const user = await getCurrentUser();
        if (user) {
          const provider = await getProviderByOwnerId(user.id);
          if (provider) {
            pid = provider.id;
            pname = provider.name;
            setProviderId(pid);
            setProviderName(pname);
          }
        }
      }
      if (!pid) {
        setLoading(false);
        return;
      }
      const [providerStats, allBookings, allReviews] = await Promise.all([
        getProviderStats(pid),
        getBookingsByBusiness(pid),
        getReviews(pid),
      ]);

      setStats(providerStats);

      const sortedBookings = allBookings
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      const sortedReviews = allReviews
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      setBookings(sortedBookings);
      setReviews(sortedReviews);
    } catch (error) {
      console.log('Dashboard load error:', error);
    }
    setLoading(false);
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? colors.warning : colors.textMuted}
        />
      );
    }
    return stars;
  };

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {providerName}
          </Text>
          <Text style={styles.headerSubtitle}>Provider Dashboard</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {stats && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.purple }]}>
                <Ionicons name="calendar" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.totalBookings}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.success }]}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.completedBookings}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.warning }]}>
                <Ionicons name="hourglass" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.pendingBookings}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
              <View style={[styles.statIconWrap, { backgroundColor: colors.info }]}>
                <Ionicons name="star" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.avgRating || '—'}</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <Text style={styles.sectionCount}>{bookings.length}</Text>
          </View>

          {bookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No bookings yet</Text>
            </View>
          ) : (
            bookings.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingLeft}>
                  <View style={styles.bookingAvatar}>
                    <Ionicons name="person" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingUser}>{booking.userName}</Text>
                    <Text style={styles.bookingMeta}>
                      {booking.date} · {booking.time}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[booking.status] + '20' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[booking.status] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[booking.status] },
                    ]}
                  >
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <Text style={styles.sectionCount}>{reviews.length}</Text>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No reviews yet</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>
                      {review.userName ? review.userName.charAt(0).toUpperCase() : ''}
                    </Text>
                  </View>
                  <View style={styles.reviewUserWrap}>
                    <Text style={styles.reviewUser}>{review.userName}</Text>
                    <View style={styles.starsRow}>{renderStars(review.rating)}</View>
                  </View>
                </View>
                {review.text ? (
                  <Text style={styles.reviewText}>{review.text}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.headerBg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.headerText,
    maxWidth: 220,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: colors.card,
    borderRadius: 14,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  bookingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bookingAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingUser: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  bookingMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  reviewUserWrap: {
    flex: 1,
  },
  reviewUser: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 3,
    gap: 2,
  },
  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
});
