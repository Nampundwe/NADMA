import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCategories } from '../data/services';
import { getCurrentUser, updateBookingStatus, getRecommendedProviders, onProvidersSnapshot, onBookingsSnapshot, onNotificationsSnapshot, onUserSnapshot, onPostsSnapshot } from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight } from '../utils/haptics';
import AnimatedCard from '../components/AnimatedCard';
import { HomeSkeleton } from '../components/Skeleton';
import { createStyleSheet } from '../utils/responsive';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [registeredBusinesses, setRegisteredBusinesses] = useState([]);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommended, setRecommended] = useState([]);
  const [categories, setCategories] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [recentPosts, setRecentPosts] = useState([]);
  const toast = useToast();

  useEffect(() => {
    const unsub1 = onProvidersSnapshot((providers) => {
      setRegisteredBusinesses(providers);
    });
    const unsub2 = onBookingsSnapshot((bookings) => {
      setPendingBookings(
        bookings
          .filter((b) => b.status === 'pending')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
    });
    let unsub3 = null;
    let unsub4 = null;
    let unsub5 = null;
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      if (u) {
        unsub4 = onUserSnapshot(u.id, (updatedUser) => {
          if (updatedUser) setUser(updatedUser);
        });
        const recs = await getRecommendedProviders(u.id);
        setRecommended(recs);
        unsub3 = onNotificationsSnapshot(u.id, (notifs) => {
          setUnreadNotifCount(notifs.filter((n) => !n.read).length);
        });
      }
      unsub5 = onPostsSnapshot((allPosts) => {
        setRecentPosts(allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
      });
      const cats = await getCategories();
      setCategories(cats);
      setLoading(false);
    })();
    return () => { unsub1(); unsub2(); if (unsub3) unsub3(); if (unsub4) unsub4(); if (unsub5) unsub5(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const u = await getCurrentUser();
    setUser(u);
    setRefreshing(false);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const q = text.toLowerCase();
      const results = registeredBusinesses.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.services.some((s) => s.toLowerCase().includes(q)) ||
          b.category.toLowerCase().includes(q)
      );
      setSearchResults(results);
    } else {
      setSearchResults(registeredBusinesses);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchMode(false);
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 7)}w ago`;
  };

  const handleApproveBooking = (booking) => {
    Alert.alert('Approve Booking', `Approve booking by ${booking.userName} with ${booking.businessName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'success',
        onPress: async () => {
          await updateBookingStatus(booking.id, 'approved');
          toast.success('Booking approved');
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
          toast.error('Booking rejected');
        },
      },
    ]);
  };

  const getProviderCount = (categoryName) => {
    return registeredBusinesses.filter((b) => b.category === categoryName).length;
  };

  const getStyles = (colors) => createStyleSheet({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      backgroundColor: colors.headerBg,
      paddingTop: 12,
      paddingBottom: 20,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandIcon: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    brandText: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.headerText,
      letterSpacing: 0.3,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.glassBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    profileBtnCircle: {
      flex: 1,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileBtnImage: {
      width: '100%',
      height: '100%',
    },
    profileBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    greeting: {
      fontSize: 14,
      color: colors.textSecondary,
      paddingHorizontal: 20,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.headerText,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    searchBarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      marginHorizontal: 20,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    searchBarPlaceholder: {
      flex: 1,
      fontSize: 14,
      color: colors.textMuted,
    },
    headerStats: {
      flexDirection: 'row',
      marginTop: 14,
      marginHorizontal: 20,
      gap: 8,
    },
    headerStat: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 12,
      paddingVertical: 10,
    },
    headerStatDivider: {
      width: 0,
    },
    headerStatNumber: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.primary,
    },
    headerStatLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1,
      fontWeight: '500',
    },

    // Admin Section
    adminSection: {
      padding: 16,
      paddingBottom: 0,
    },
    registerBanner: {
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
    },
    bannerIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    registerBannerText: {
      flex: 1,
      marginLeft: 14,
    },
    registerBannerTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#fff',
    },
    registerBannerSubtitle: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    bannerArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingBookingsSection: {
      backgroundColor: colors.cardSolid,
      borderRadius: 16,
      padding: 16,
    },
    pendingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    pendingHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pendingIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.warning,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
    },
    pendingCountBadge: {
      backgroundColor: colors.warning,
      borderRadius: 10,
      minWidth: 22,
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    pendingCountText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#fff',
    },
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    viewAllText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    bookingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.glassBg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    bookingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    bookingAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bookingAvatarText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#fff',
    },
    bookingInfo: {
      flex: 1,
    },
    bookingUser: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    bookingService: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 1,
    },
    bookingMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    bookingTime: {
      fontSize: 11,
      color: colors.textMuted,
    },
    bookingActions: {
      flexDirection: 'row',
      gap: 6,
    },
    approveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rejectBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
    },

    categoriesSection: {
      paddingTop: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sectionSubtext: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    seeAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    categoriesScroll: {
      paddingLeft: 16,
      paddingRight: 8,
      gap: 12,
    },
    categoryCard: {
      width: 200,
      height: 110,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    categoryImage: {
      width: '100%',
      height: '100%',
    },
    categoryOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    categoryContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
    },
    categoryBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    categoryName: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
      marginBottom: 2,
    },
    categoryTagline: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.75)',
    },

    // Popular Providers
    popularSection: {
      paddingBottom: 4,
    },
    popularScroll: {
      paddingLeft: 16,
      paddingRight: 8,
    },
    popularCard: {
      width: 160,
      height: 200,
      borderRadius: 16,
      marginRight: 12,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    popularImage: {
      width: '100%',
      height: '100%',
    },
    popularOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    popularInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
    },
    popularRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: 4,
    },
    popularRatingText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    popularName: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 2,
    },
    popularCategory: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.8)',
    },
    popularPrice: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 4,
    },

    // Featured Section
    featuredSection: {
      paddingBottom: 4,
    },
    featuredScroll: {
      paddingLeft: 16,
      paddingRight: 8,
      gap: 12,
    },
    featuredCard: {
      width: 200,
      backgroundColor: colors.glassBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
    },
    featuredImageWrap: {
      width: '100%',
      height: 120,
      position: 'relative',
    },
    featuredImage: {
      width: '100%',
      height: '100%',
    },
    featuredCategoryTag: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    featuredCategoryText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    },
    featuredInfo: {
      padding: 12,
    },
    featuredName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    featuredRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 6,
    },
    featuredRatingText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    featuredPrice: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },

    // Recent Activity
    activitySection: {
      paddingBottom: 4,
      paddingHorizontal: 16,
    },
    activityCard: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    activityAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    activityAvatarText: {
      fontSize: 15,
      fontWeight: '700',
    },
    activityInfo: {
      flex: 1,
    },
    activityUser: {
      fontSize: 13,
      fontWeight: '600',
    },
    activityTime: {
      fontSize: 11,
      marginTop: 1,
    },
    activityCategory: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    activityCategoryText: {
      fontSize: 11,
      fontWeight: '600',
    },
    activityTitle: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
      lineHeight: 20,
    },
    activityFooter: {
      flexDirection: 'row',
      gap: 14,
    },
    activityStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    activityStatText: {
      fontSize: 12,
    },

    // About
    aboutSection: {
      padding: 16,
    },
    aboutCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    aboutIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    aboutContent: {
      flex: 1,
    },
    aboutTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 2,
    },
    aboutText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },

    // Search Results
    searchResultsContainer: {
      flex: 1,
    },
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.cardSolid,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 3,
    },
    backButton: {
      padding: 8,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glassBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginLeft: 8,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontSize: 15,
      color: colors.text,
    },
    resultCount: {
      fontSize: 13,
      color: colors.textSecondary,
      padding: 16,
      paddingBottom: 8,
    },
    searchResultsList: {
      padding: 16,
      paddingTop: 4,
    },
    searchResultCard: {
      flexDirection: 'row',
      backgroundColor: colors.glassBg,
      borderRadius: 14,
      marginBottom: 10,
      overflow: 'hidden',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    searchResultImage: {
      width: 56,
      height: 56,
      borderRadius: 12,
    },
    searchResultInfo: {
      flex: 1,
      marginLeft: 12,
    },
    searchResultName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    searchResultCategory: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    searchResultRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    searchResultRatingText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.glassBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
    },
    section: { marginBottom: 8, paddingTop: 16 },
    recCard: {
      width: 140,
      padding: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    recAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    recAvatarText: { fontSize: 20, fontWeight: 'bold' },
    recName: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
    recCategory: { fontSize: 12, marginTop: 2 },
    recRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    recRatingText: { fontSize: 12 },
    recMatchBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    recMatchText: { fontSize: 10, fontWeight: '600' },
  });

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResultCard}
      activeOpacity={0.7}
      onPress={() => { hapticLight(); navigation.navigate('ServiceDetail', { service: item }); }}
      accessibilityLabel={item.name}
      accessibilityRole="button"
    >
      <Image source={{ uri: item.image }} style={styles.searchResultImage} />
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultCategory}>{item.category}</Text>
        <View style={styles.searchResultRating}>
                  <Ionicons name="star" size={14} color={colors.warning} />
          <Text style={styles.searchResultRatingText}>
            {item.rating > 0 ? item.rating : 'New'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <HomeSkeleton colors={colors} />
      </View>
    );
  }

  if (searchMode) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
        <View style={styles.searchResultsContainer}>
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={clearSearch} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button">
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search services..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                maxLength={100}
                accessibilityLabel="Search services"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')} accessibilityLabel="Clear search" accessibilityRole="button">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.resultCount}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </Text>
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.searchResultsList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyText}>No services found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="cube" size={18} color="#fff" />
              </View>
              <Text style={styles.brandText}>Nadma</Text>
            </View>
            <View style={styles.headerActions}>
              {user && (
                <TouchableOpacity
                  style={styles.profileBtn}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('PublicProfile', { userId: user.id, userName: user.name })}
                  accessibilityLabel={`View ${user.name}'s profile`}
                  accessibilityRole="button"
                >
                  {user.profileImage ? (
                    <Image source={{ uri: user.profileImage }} style={styles.profileBtnImage} />
                  ) : (
                    <View style={styles.profileBtnCircle}>
                      <Text style={styles.profileBtnText}>
                        {user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('notifications')}
                accessibilityLabel="Notifications"
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={19} color="#fff" />
                {unreadNotifCount > 0 && (
                  <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {user && user.role === 'admin' && (
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Profile', { screen: 'Admin' })}
                  accessibilityLabel="Admin panel"
                  accessibilityRole="button"
                >
                  <Ionicons name="shield-checkmark" size={19} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.greeting}>
            {user ? `Hello, ${user.name?.split(' ')[0]}` : 'Hello!'}
          </Text>
          <Text style={styles.headerTitle}>What service do you{'\n'}need today?</Text>

          <TouchableOpacity
            style={styles.searchBarHeader}
            activeOpacity={0.8}
            onPress={() => { setSearchMode(true); handleSearch(''); }}
            accessibilityLabel="Search services"
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <Text style={styles.searchBarPlaceholder}>Search services or providers...</Text>
          </TouchableOpacity>

          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{registeredBusinesses.length}</Text>
              <Text style={styles.headerStatLabel}>Providers</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{categories.length}</Text>
              <Text style={styles.headerStatLabel}>Services</Text>
            </View>
          </View>
        </View>

        {/* Service Categories */}
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Services', { categoryName: categories[0]?.name })}
              accessibilityLabel="View all services"
              accessibilityRole="button"
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map((category) => {
              const count = getProviderCount(category.name);
              return (
                <AnimatedCard
                  key={category.id}
                  style={styles.categoryCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Services', { categoryName: category.name })}
                  accessibilityLabel={category.name}
                  accessibilityRole="button"
                >
                  <Image source={{ uri: category.image }} style={styles.categoryImage} />
                  <View style={styles.categoryOverlay} />
                  <View style={styles.categoryBadge}>
                    <Ionicons name="business" size={11} color="#fff" />
                    <Text style={styles.categoryBadgeText}>{count}</Text>
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                    <Text style={styles.categoryTagline} numberOfLines={1}>{category.tagline}</Text>
                  </View>
                </AnimatedCard>
              );
            })}
          </ScrollView>
        </View>
        {user && user.role === 'admin' && (
          <View style={styles.adminSection}>
            <TouchableOpacity
              style={styles.registerBanner}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Register a business"
              accessibilityRole="button"
            >
              <View style={styles.bannerIconCircle}>
                <Ionicons name="add-circle" size={24} color="#fff" />
              </View>
              <View style={styles.registerBannerText}>
                <Text style={styles.registerBannerTitle}>Register a Business</Text>
                <Text style={styles.registerBannerSubtitle}>Add a new service listing</Text>
              </View>
              <View style={styles.bannerArrow}>
                <Ionicons name="chevron-right" size={18} color="#fff" />
              </View>
            </TouchableOpacity>

            {pendingBookings.length > 0 && (
              <View style={styles.pendingBookingsSection}>
                <View style={styles.pendingHeader}>
                  <View style={styles.pendingHeaderLeft}>
                    <View style={styles.pendingIconCircle}>
                      <Ionicons name="schedule" size={16} color={colors.warning} />
                    </View>
                    <Text style={styles.pendingTitle}>Pending Bookings</Text>
                    <View style={styles.pendingCountBadge}>
                      <Text style={styles.pendingCountText}>{pendingBookings.length}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewAllBtn}
                    onPress={() => navigation.navigate('Profile', { screen: 'Admin' })}
                    accessibilityLabel="View all pending bookings"
                    accessibilityRole="button"
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="arrow-forward-outline" size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                {pendingBookings.slice(0, 3).map((booking) => (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View style={styles.bookingLeft}>
                      <View style={styles.bookingAvatar}>
                        <Text style={styles.bookingAvatarText}>
                          {booking.userName?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.bookingInfo}>
                        <Text style={styles.bookingUser}>{booking.userName}</Text>
                        <Text style={styles.bookingService}>{booking.businessName}</Text>
                        <View style={styles.bookingMeta}>
                          <Ionicons name="calendar" size={11} color={colors.textMuted} />
                          <Text style={styles.bookingTime}>{booking.date} at {booking.time}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.bookingActions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        activeOpacity={0.7}
                        onPress={() => handleApproveBooking(booking)}
                        accessibilityLabel={`Approve booking by ${booking.userName}`}
                        accessibilityRole="button"
                      >
                        <Ionicons name="check" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        activeOpacity={0.7}
                        onPress={() => handleRejectBooking(booking)}
                        accessibilityLabel={`Reject booking by ${booking.userName}`}
                        accessibilityRole="button"
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Provider Dashboard Banner */}
        {user && user.role === 'provider' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.registerBanner, { backgroundColor: colors.success }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Profile', { screen: 'ProviderDashboard' })}
              accessibilityLabel="My business dashboard"
              accessibilityRole="button"
            >
              <View style={styles.bannerIconCircle}>
                <Ionicons name="business" size={24} color="#fff" />
              </View>
              <View style={styles.registerBannerText}>
                <Text style={styles.registerBannerTitle}>My Business Dashboard</Text>
                <Text style={styles.registerBannerSubtitle}>View bookings, reviews, and stats</Text>
              </View>
              <View style={styles.bannerArrow}>
                <Ionicons name="chevron-right" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Recommended for You */}
        {user && user.role !== 'admin' && recommended.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended for You</Text>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <FlatList
              horizontal
              data={recommended}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.recCard, { backgroundColor: colors.card }]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('ServiceDetail', { service: item })}
                >
                  <View style={[styles.recAvatar, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.recAvatarText, { color: colors.primary }]}>
                      {item.name?.charAt(0)}
                    </Text>
                  </View>
                  <Text style={[styles.recName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.recCategory, { color: colors.textSecondary }]}>{item.category}</Text>
                  <View style={styles.recRating}>
                    <Ionicons name="star" size={11} color={colors.warning} />
                    <Text style={[styles.recRatingText, { color: colors.textSecondary }]}>{item.rating?.toFixed(1) || 'New'}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Featured Service Providers */}
        {registeredBusinesses.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Service Providers</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Services', { categoryName: categories[0]?.name })}
                accessibilityLabel="View all providers"
                accessibilityRole="button"
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
              {registeredBusinesses.slice(0, 6).map((business) => (
                <AnimatedCard
                  key={business.id}
                  style={styles.featuredCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ServiceDetail', { service: business })}
                  accessibilityLabel={business.name}
                  accessibilityRole="button"
                >
                  <View style={styles.featuredImageWrap}>
                    <Image source={{ uri: business.image }} style={styles.featuredImage} />
                    <View style={styles.featuredCategoryTag}>
                      <Text style={styles.featuredCategoryText}>{business.category}</Text>
                    </View>
                  </View>
                  <View style={styles.featuredInfo}>
                    <Text style={styles.featuredName} numberOfLines={1}>{business.name}</Text>
                    <View style={styles.featuredRating}>
                      <Ionicons name="star" size={12} color={colors.warning} />
                      <Text style={styles.featuredRatingText}>{business.rating || 'New'}</Text>
                    </View>
                    {business.price && (
                      <Text style={styles.featuredPrice}>{business.price}</Text>
                    )}
                  </View>
                </AnimatedCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Activity */}
        {recentPosts.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Community')}
                activeOpacity={0.7}
              >
                <Text style={[styles.sectionLink, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentPosts.map((post) => {
              const reactions = post.reactions || {};
              const totalReactions = Object.keys(reactions).length;
              const reactionCounts = {};
              Object.values(reactions).forEach((r) => { reactionCounts[r] = (reactionCounts[r] || 0) + 1; });
              return (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.activityCard, { backgroundColor: colors.card }]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                >
                  <View style={styles.activityHeader}>
                    <View style={[styles.activityAvatar, { backgroundColor: colors.primary + '20' }]}>
                      {post.userProfileImage ? (
                        <Image source={{ uri: post.userProfileImage }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <Text style={[styles.activityAvatarText, { color: colors.primary }]}>
                          {post.userName ? post.userName.charAt(0).toUpperCase() : ''}
                        </Text>
                      )}
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityUser, { color: colors.text }]} numberOfLines={1}>
                        {post.userName}
                      </Text>
                      <Text style={[styles.activityTime, { color: colors.textMuted }]}>
                        {getTimeAgo(post.createdAt)}
                      </Text>
                    </View>
                    {post.category && (
                      <View style={[styles.activityCategory, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.activityCategoryText, { color: colors.primary }]}>{post.category}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                    {post.title || post.description?.substring(0, 60)}
                  </Text>
                  <View style={styles.activityFooter}>
                    <View style={styles.activityStat}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.activityStatText, { color: colors.textMuted }]}>
                        {post.commentCount || 0}
                      </Text>
                    </View>
                    {totalReactions > 0 && (
                      <View style={styles.activityStat}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          {Object.entries(reactionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([emoji, count]) => (
                            <Text key={emoji} style={{ fontSize: 12 }}>{emoji}</Text>
                          ))}
                        </View>
                        <Text style={[styles.activityStatText, { color: colors.textMuted }]}>
                          {totalReactions}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* About */}
        <View style={styles.aboutSection}>
          <View style={styles.aboutCard}>
            <View style={styles.aboutIconContainer}>
              <Ionicons name="cube" size={20} color="#fff" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutTitle}>About Nadma</Text>
              <Text style={styles.aboutText}>
                Connecting Nampundwe with trusted local service providers.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
