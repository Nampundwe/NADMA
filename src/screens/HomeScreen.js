import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  StatusBar,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCategories } from '../data/services';
import { getApprovedBusinesses, getCurrentUser, getAllServiceProviders, getAllBookings, updateBookingStatus, getRecommendedProviders } from '../data/storage';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticMedium } from '../utils/haptics';
import AnimatedCard from '../components/AnimatedCard';

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

  useEffect(() => {
    (async () => {
      await loadBusinesses();
      const u = await getCurrentUser();
      setUser(u);
      if (u) {
        const recs = await getRecommendedProviders(u.id);
        setRecommended(recs);
      }
      const cats = await getCategories();
      setCategories(cats);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getApprovedBusinesses().then(setRegisteredBusinesses);
      getCurrentUser().then(setUser);
      getCategories().then(setCategories);
      loadBusinesses();
    });
    return unsubscribe;
  }, [navigation]);

  const loadBusinesses = async () => {
    const businesses = await getApprovedBusinesses();
    const providers = await getAllServiceProviders();
    setRegisteredBusinesses([...businesses, ...providers]);
    const allBookings = await getAllBookings();
    setPendingBookings(
      allBookings
        .filter((b) => b.status === 'pending')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBusinesses();
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

  const handleApproveBooking = (booking) => {
    Alert.alert('Approve Booking', `Approve booking by ${booking.userName} with ${booking.businessName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'success',
        onPress: async () => {
          await updateBookingStatus(booking.id, 'approved');
          loadBusinesses();
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
          loadBusinesses();
        },
      },
    ]);
  };

  const getProviderCount = (categoryName) => {
    return registeredBusinesses.filter((b) => b.category === categoryName).length;
  };

  const getStyles = (colors) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      backgroundColor: colors.headerBg,
      paddingTop: 16,
      paddingBottom: 28,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    greeting: {
      fontSize: 15,
      color: '#C5CAE9',
      marginBottom: 4,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.headerText,
      lineHeight: 32,
    },
    adminAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: 20,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    searchBarPlaceholder: {
      flex: 1,
      fontSize: 15,
      color: colors.textMuted,
    },
    searchMic: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerStats: {
      flexDirection: 'row',
      marginTop: 20,
      marginHorizontal: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 14,
      padding: 14,
    },
    headerStat: {
      flex: 1,
      alignItems: 'center',
    },
    headerStatDivider: {
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    headerStatNumber: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.headerText,
    },
    headerStatLabel: {
      fontSize: 11,
      color: '#C5CAE9',
      marginTop: 2,
    },

    // Admin Section
    adminSection: {
      padding: 16,
      paddingBottom: 0,
    },
    registerBanner: {
      backgroundColor: '#4CAF50',
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
      backgroundColor: colors.card,
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
      backgroundColor: '#FFF3E0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
    },
    pendingCountBadge: {
      backgroundColor: '#FF9800',
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
      backgroundColor: colors.borderLight,
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
      backgroundColor: '#4CAF50',
      justifyContent: 'center',
      alignItems: 'center',
    },
    rejectBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F44336',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Contact Admin Banner
    contactAdminBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary,
      margin: 16,
      marginBottom: 0,
      padding: 16,
      borderRadius: 16,
    },
    contactAdminLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    contactAdminIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    contactAdminTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: '#fff',
    },
    contactAdminSubtitle: {
      fontSize: 12,
      color: '#C5CAE9',
      marginTop: 1,
    },

    // Categories - Ad Banners
    categoriesSection: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 19,
      fontWeight: 'bold',
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
    adBannersContainer: {
      gap: 12,
    },
    adBannerCard: {
      height: 110,
      borderRadius: 18,
      overflow: 'hidden',
      position: 'relative',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 6,
    },
    adBannerImage: {
      width: '100%',
      height: '100%',
    },
    adBannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    adBannerContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    adBannerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    adBannerText: {
      flex: 1,
    },
    adBannerName: {
      fontSize: 17,
      fontWeight: 'bold',
      color: '#fff',
    },
    adBannerTagline: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    adBannerRight: {
      alignItems: 'center',
    },
    adBannerCount: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#fff',
    },
    adBannerCountLabel: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
    },
    adBannerArrow: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
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

    // About
    aboutSection: {
      padding: 16,
    },
    aboutCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    aboutIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    aboutContent: {
      flex: 1,
    },
    aboutTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    aboutText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // Search Results
    searchResultsContainer: {
      flex: 1,
    },
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.card,
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
      backgroundColor: colors.borderLight,
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
      backgroundColor: colors.card,
      borderRadius: 14,
      marginBottom: 10,
      overflow: 'hidden',
      alignItems: 'center',
      padding: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
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
      backgroundColor: colors.borderLight,
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
    // Emergency
    emergencySection: {
      padding: 16,
      paddingBottom: 0,
    },
    emergencyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    emergencyIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FEE2E2',
      justifyContent: 'center',
      alignItems: 'center',
    },
    emergencyTitle: {
      fontSize: 19,
      fontWeight: 'bold',
      color: '#F44336',
    },
    emergencySubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 12,
    },
    emergencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    emergencyCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      shadowColor: '#F44336',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      alignItems: 'center',
    },
    emergencyCardIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    emergencyCardIconInner: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emergencyCardName: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 2,
    },
    emergencyCardDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 8,
      textAlign: 'center',
    },
    emergencyCallBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      gap: 4,
    },
    emergencyCallText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff',
    },
    section: { marginBottom: 24 },
    recCard: {
      width: 140,
      padding: 14,
      borderRadius: 14,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
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

  const styles = getStyles(colors);

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
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.searchResultRatingText}>
            {item.rating > 0 ? item.rating : 'New'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
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
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search services..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
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
            <View>
              <Text style={styles.greeting}>
                {user ? `Hello, ${user.name?.split(' ')[0]}` : 'Hello!'}
              </Text>
              <Text style={styles.headerTitle}>Find trusted services{'\n'}in Nampundwe</Text>
            </View>
            {user && user.role === 'admin' && (
              <View style={styles.adminAvatar}>
                <Ionicons name="shield-checkmark" size={22} color="#fff" />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.searchBarHeader}
            activeOpacity={0.8}
            onPress={() => { setSearchMode(true); handleSearch(''); }}
            accessibilityLabel="Search services"
            accessibilityRole="button"
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <Text style={styles.searchBarPlaceholder}>Search for services, providers...</Text>
            <View style={styles.searchMic}>
              <Ionicons name="mic" size={18} color={colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 20, marginTop: 12, paddingVertical: 10, borderRadius: 12, gap: 8 }}
            onPress={() => navigation.navigate('Map')}
            accessibilityLabel="View service map"
            accessibilityRole="button"
          >
            <Ionicons name="map" size={18} color="#fff" />
            <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>View Service Map</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{registeredBusinesses.length}</Text>
              <Text style={styles.headerStatLabel}>Providers</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{categories.length}</Text>
              <Text style={styles.headerStatLabel}>Categories</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatNumber}>{pendingBookings.length}</Text>
              <Text style={styles.headerStatLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Admin Banners */}
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
                <Ionicons name="add-circle" size={28} color="#fff" />
              </View>
              <View style={styles.registerBannerText}>
                <Text style={styles.registerBannerTitle}>Register a Business</Text>
                <Text style={styles.registerBannerSubtitle}>Add a new service listing</Text>
              </View>
              <View style={styles.bannerArrow}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            {pendingBookings.length > 0 && (
              <View style={styles.pendingBookingsSection}>
                <View style={styles.pendingHeader}>
                  <View style={styles.pendingHeaderLeft}>
                    <View style={styles.pendingIconCircle}>
                      <Ionicons name="time" size={18} color="#FF9800" />
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
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
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
                          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
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
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        activeOpacity={0.7}
                        onPress={() => handleRejectBooking(booking)}
                        accessibilityLabel={`Reject booking by ${booking.userName}`}
                        accessibilityRole="button"
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Contact Admin Banner for Users */}
        {user && user.role !== 'admin' && (
          <TouchableOpacity
            style={styles.contactAdminBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Chat', {
              receiverId: 'admin',
              receiverName: 'Admin Support',
              conversationType: 'admin',
            })}
            accessibilityLabel="Contact admin support"
            accessibilityRole="button"
          >
            <View style={styles.contactAdminLeft}>
              <View style={styles.contactAdminIcon}>
                <Ionicons name="help-buoy" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.contactAdminTitle}>Need Help?</Text>
                <Text style={styles.contactAdminSubtitle}>Contact admin support</Text>
              </View>
            </View>
            <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Emergency Services */}
        <View style={styles.emergencySection}>
          <View style={styles.emergencyHeader}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="flash" size={20} color="#F44336" />
            </View>
            <Text style={styles.emergencyTitle}>Quick Emergency Help</Text>
          </View>
          <Text style={styles.emergencySubtitle}>Tap to call immediately</Text>
          <View style={styles.emergencyGrid}>
            {[
              { name: 'Plumber', icon: 'water', phone: '+260970000001', color: '#2196F3', desc: 'Burst pipes, leaks' },
              { name: 'Electrician', icon: 'flash', phone: '+260970000002', color: '#FF9800', desc: 'Power outages, faults' },
              { name: 'Carpenter', icon: 'hammer', phone: '+260970000003', color: '#795548', desc: 'Locks, doors, windows' },
              { name: 'General', icon: 'construct', phone: '+260970000004', color: '#4CAF50', desc: 'Any urgent repair' },
            ].map((item) => (
              <TouchableOpacity
                key={item.name}
                style={styles.emergencyCard}
                activeOpacity={0.8}
                onPress={() => {
                  hapticMedium();
                  Alert.alert(
                    `Call ${item.name}?`,
                    item.desc,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Call Now', onPress: () => Linking.openURL(`tel:${item.phone}`) },
                    ]
                  );
                }}
                accessibilityLabel={`Call ${item.name}`}
                accessibilityRole="button"
              >
                <View style={[styles.emergencyCardIcon, { backgroundColor: item.color + '20' }]}>
                  <View style={[styles.emergencyCardIconInner, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon} size={20} color="#fff" />
                  </View>
                </View>
                <Text style={styles.emergencyCardName}>{item.name}</Text>
                <Text style={styles.emergencyCardDesc}>{item.desc}</Text>
                <View style={[styles.emergencyCallBtn, { backgroundColor: item.color }]}>
                  <Ionicons name="call" size={14} color="#fff" />
                  <Text style={styles.emergencyCallText}>Call</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recommended for You */}
        {recommended.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended for You</Text>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
            </View>
            <FlatList
              horizontal
              data={recommended}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
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
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={[styles.recRatingText, { color: colors.textSecondary }]}>{item.rating?.toFixed(1) || 'New'}</Text>
                  </View>
                  {item.matchScore > 10 && (
                    <View style={[styles.recMatchBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.recMatchText, { color: colors.primary }]}>Great Match</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Service Categories - Ad Banners */}
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Services</Text>
            <Text style={styles.sectionSubtext}>Browse trusted local providers</Text>
          </View>
          <View style={styles.adBannersContainer}>
            {categories.map((category) => {
              const count = getProviderCount(category.name);
              return (
                <AnimatedCard
                  key={category.id}
                  style={styles.adBannerCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Services', { categoryName: category.name })}
                  accessibilityLabel={category.name}
                  accessibilityRole="button"
                >
                  <Image source={{ uri: category.image }} style={styles.adBannerImage} />
                  <View style={styles.adBannerOverlay} />
                  <View style={styles.adBannerContent}>
                    <View style={[styles.adBannerIcon, { backgroundColor: category.color }]}>
                      <Ionicons name={category.icon} size={22} color="#fff" />
                    </View>
                    <View style={styles.adBannerText}>
                      <Text style={styles.adBannerName}>{category.name}</Text>
                      <Text style={styles.adBannerTagline} numberOfLines={1}>{category.tagline}</Text>
                    </View>
                    <View style={styles.adBannerRight}>
                      <Text style={styles.adBannerCount}>{count}</Text>
                      <Text style={styles.adBannerCountLabel}>providers</Text>
                    </View>
                  </View>
                  <View style={styles.adBannerArrow}>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
                </AnimatedCard>
              );
            })}
          </View>
        </View>

        {/* Popular Providers */}
        {registeredBusinesses.length > 0 && (
          <View style={styles.popularSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Providers</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
              {registeredBusinesses.slice(0, 6).map((business) => (
                <AnimatedCard
                  key={business.id}
                  style={styles.popularCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('ServiceDetail', { service: business })}
                  accessibilityLabel={business.name}
                  accessibilityRole="button"
                >
                  <Image source={{ uri: business.image }} style={styles.popularImage} />
                  <View style={styles.popularOverlay} />
                  <View style={styles.popularInfo}>
                    <View style={styles.popularRating}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.popularRatingText}>{business.rating || 'New'}</Text>
                    </View>
                    <Text style={styles.popularName} numberOfLines={1}>{business.name}</Text>
                    <Text style={styles.popularCategory}>{business.category}</Text>
                  </View>
                </AnimatedCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* About Card */}
        <View style={styles.aboutSection}>
          <View style={styles.aboutCard}>
            <View style={styles.aboutIconContainer}>
              <Ionicons name="information-circle" size={28} color={colors.primary} />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutTitle}>About Nadma</Text>
              <Text style={styles.aboutText}>
                Connecting Nampundwe with trusted local service providers.
                Find plumbers, electricians, carpenters, and more.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
