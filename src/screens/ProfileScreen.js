import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProfileSkeleton } from '../components/Skeleton';
import {
  getCurrentUser,
  logout,
  updateCurrentUser,
  getFavorites,
  getAllReviews,
  getRegisteredBusinesses,
  generateReferralCode,
  onFollowersSnapshot,
  getFollowingCount,
} from '../data/firebaseStorage';
import { AuthContext } from '../navigation/AppNavigator';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticWarning } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';
import { useToast } from '../context/ToastContext';

export default function ProfileScreen({ navigation }) {
  const { onLogout } = useContext(AuthContext);
  const { colors } = useTheme();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editHeadline, setEditHeadline] = useState('');
  const [stats, setStats] = useState({ favorites: 0, reviews: 0, businesses: 0 });
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [referralCode, setReferralCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => loadUser());
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubFollowers = onFollowersSnapshot(user.id, (count) => setFollowers(count));
    getFollowingCount(user.id).then(setFollowing);
    return () => {
      if (unsubFollowers) unsubFollowers();
    };
  }, [user?.id]);

  const loadUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      setEditName(currentUser.name);
      setEditHeadline(currentUser.headline || '');
      const favs = await getFavorites();
      const reviews = await getAllReviews();
      const businesses = await getRegisteredBusinesses();
      setStats({
        favorites: favs.length,
        reviews: reviews.filter((r) => r.userId === currentUser.id).length,
        businesses: businesses.filter((b) => b.ownerId === currentUser.id).length,
      });
      const code = await generateReferralCode(currentUser.id);
      setReferralCode(code);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          hapticWarning();
          await logout();
          onLogout();
        },
      },
    ]);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    await updateCurrentUser({ name: editName.trim() });
    hapticSuccess();
    setUser({ ...user, name: editName.trim() });
    setEditing(false);
  };

  const handleSaveHeadline = async () => {
    const headline = editHeadline.trim();
    await updateCurrentUser({ headline });
    hapticSuccess();
    setUser({ ...user, headline });
    setEditingHeadline(false);
  };

  const getRoleBadge = () => {
    switch (user?.role) {
      case 'admin':
        return { label: 'Admin', color: colors.danger, icon: 'verified-user' };
      default:
        return { label: 'User', color: colors.info, icon: 'person' };
    }
  };

  const getStyles = (colors) => createStyleSheet({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    loggedOutContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    loggedOutIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    loggedOutTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    loggedOutText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 28,
      lineHeight: 20,
    },
    loginButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 40,
      paddingVertical: 14,
      borderRadius: 14,
      marginBottom: 12,
    },
    loginButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    guestInfoBtn: {
      padding: 12,
    },
    guestInfoText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    header: {
      backgroundColor: colors.headerBg,
      padding: 24,
      paddingBottom: 32,
      alignItems: 'center',
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    avatarContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#fff',
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#fff',
    },
    editContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    editInput: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
      minWidth: 160,
    },
    editSaveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editCancelBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    userEmail: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
      marginBottom: 12,
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      gap: 4,
    },
    roleBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors.card,
      margin: 16,
      borderRadius: 16,
      padding: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    statItem: {
      width: '50%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      justifyContent: 'flex-start',
    },
    statNumber: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    headlineRow: {
      marginBottom: 12,
      alignItems: 'center',
    },
    headlineDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    userHeadline: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    editHeadlineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    editHeadlineInput: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 14,
      color: '#fff',
      minWidth: 200,
    },
    menuSection: {
      margin: 16,
      marginBottom: 0,
    },
    menuSectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 14,
      borderRadius: 14,
      marginBottom: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuItemText: {
      flex: 1,
      marginLeft: 12,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    menuRight: {
      alignItems: 'center',
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 16,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.dangerLight,
      gap: 8,
    },
    logoutText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.danger,
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.textMuted,
    },
    referralCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    referralHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    referralCodeBox: {
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    referralCodeLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    referralCode: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      letterSpacing: 2,
    },
    referralShareBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 12,
      gap: 8,
    },
    referralShareText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: 'bold',
    },
  });

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <ProfileSkeleton />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={styles.loggedOutContainer}>
          <View style={styles.loggedOutIcon}>
            <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={styles.loggedOutTitle}>Not Signed In</Text>
          <Text style={styles.loggedOutText}>Sign in to access your profile, bookings, and favorites</Text>
          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.85}
            onPress={() =>       navigation.navigate('Auth')}
            accessibilityLabel="Sign in"
            accessibilityRole="button"
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const roleBadge = getRoleBadge();
  const initials = user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          {editing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                placeholderTextColor={colors.textMuted}
                maxLength={50}
                accessibilityLabel="Edit name"
              />
               <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveName} accessibilityLabel="Save name" accessibilityRole="button">
                <Ionicons name="check" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditing(false)} accessibilityLabel="Cancel editing" accessibilityRole="button">
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <TouchableOpacity onPress={() => setEditing(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Edit name" accessibilityRole="button">
                <Ionicons name="pencil" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.userEmail}>{user.email || 'Guest User'}</Text>
          <View style={styles.headlineRow}>
            {editingHeadline ? (
              <View style={styles.editHeadlineContainer}>
                <TextInput
                  style={styles.editHeadlineInput}
                  value={editHeadline}
                  onChangeText={setEditHeadline}
                  autoFocus
                  placeholder="Add a headline e.g. Certified Plumber"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  maxLength={80}
                  accessibilityLabel="Edit headline"
                />
                <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveHeadline} accessibilityLabel="Save headline" accessibilityRole="button">
                  <Ionicons name="check" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingHeadline(false)} accessibilityLabel="Cancel headline edit" accessibilityRole="button">
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.headlineDisplay}
                onPress={() => setEditingHeadline(true)}
                activeOpacity={0.7}
                accessibilityLabel="Edit headline"
                accessibilityRole="button"
              >
                <Text style={styles.userHeadline}>
                  {user.headline || 'Add a professional headline'}
                </Text>
                <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleBadge.color }]}>
            <Ionicons name={roleBadge.icon} size={12} color="#fff" />
            <Text style={styles.roleBadgeText}>{roleBadge.label}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
              <Ionicons name="heart" size={20} color={colors.danger} />
            <Text style={styles.statNumber}>{stats.favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={styles.statNumber}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chat" size={20} color={colors.warning} />
            <Text style={styles.statNumber}>{stats.reviews}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statItem}>
              <Ionicons name="storefront" size={20} color={colors.success} />
            <Text style={styles.statNumber}>{stats.businesses}</Text>
            <Text style={styles.statLabel}>Businesses</Text>
          </View>
        </View>

        {/* Account Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('EditProfile'); }} accessibilityLabel="Edit professional profile" accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="ribbon" size={20} color={colors.success} />
            </View>
            <Text style={styles.menuItemText}>Professional Profile</Text>
            <View style={styles.menuRight}>
              <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('MyBookings'); }} accessibilityLabel="My bookings" accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="calendar" size={20} color={colors.info} />
            </View>
            <Text style={styles.menuItemText}>My Bookings</Text>
            <View style={styles.menuRight}>
              <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('Favorites'); }} accessibilityLabel="My favorites" accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
            <Ionicons name="heart" size={20} color={colors.danger} />
            </View>
            <Text style={styles.menuItemText}>My Favorites</Text>
            <View style={styles.menuRight}>
              <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('notifications'); }} accessibilityLabel="Notifications" accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="notifications" size={20} color={colors.warning} />
            </View>
            <Text style={styles.menuItemText}>Notifications</Text>
            <View style={styles.menuRight}>
              <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {user.role !== 'admin' && (
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => { hapticLight(); navigation.navigate('Chat', {
                receiverId: 'admin',
                receiverName: 'Admin Support',
                conversationType: 'admin',
              }); }}
              accessibilityLabel="Contact admin"
              accessibilityRole="button"
            >
            <View style={[styles.menuIcon, { backgroundColor: colors.dangerLight }]}>
              <Ionicons name="help" size={20} color={colors.danger} />
              </View>
              <Text style={styles.menuItemText}>Contact Admin</Text>
              <View style={styles.menuRight}>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}

          {user.role === 'admin' && (
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('BookingsManager'); }} accessibilityLabel="Manage bookings" accessibilityRole="button">
              <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="clipboard" size={20} color={colors.success} />
              </View>
              <Text style={styles.menuItemText}>Manage Bookings</Text>
              <View style={styles.menuRight}>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}

          {user.role === 'provider' && (
            <>
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('ProviderDashboard'); }} accessibilityLabel="My business dashboard" accessibilityRole="button">
                <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="business" size={20} color={colors.success} />
                </View>
                <Text style={styles.menuItemText}>My Business Dashboard</Text>
                <View style={styles.menuRight}>
                  <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('BookingsManager'); }} accessibilityLabel="Manage bookings" accessibilityRole="button">
                <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="clipboard" size={20} color={colors.success} />
                </View>
                <Text style={styles.menuItemText}>Manage Bookings</Text>
                <View style={styles.menuRight}>
                  <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Admin Menu */}
        {user.role === 'admin' && (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Administration</Text>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('Admin'); }} accessibilityLabel="Admin panel" accessibilityRole="button">
              <View style={[styles.menuIcon, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.danger} />
              </View>
              <Text style={styles.menuItemText}>Admin Panel</Text>
              <View style={styles.menuRight}>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('ManageProviders'); }} accessibilityLabel="Manage providers" accessibilityRole="button">
              <View style={[styles.menuIcon, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="people" size={20} color={colors.warning} />
              </View>
              <Text style={styles.menuItemText}>Manage Providers</Text>
              <View style={styles.menuRight}>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('ManageCategories'); }} accessibilityLabel="Manage categories" accessibilityRole="button">
              <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="grid-view" size={20} color={colors.success} />
              </View>
              <Text style={styles.menuItemText}>Manage Categories</Text>
              <View style={styles.menuRight}>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Referral Section */}
        {user.role !== 'admin' && referralCode && (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Refer & Earn</Text>
            <View style={styles.referralCard}>
              <View style={styles.referralHeader}>
                <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="gift" size={20} color={colors.success} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>Invite Friends</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Share your code and help grow Nadma</Text>
                </View>
              </View>
              <View style={styles.referralCodeBox}>
                <Text style={styles.referralCodeLabel}>Your Referral Code</Text>
                <Text style={styles.referralCode}>{referralCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.referralShareBtn}
                onPress={() => {
                  const { Share } = require('react-native');
                  Share.share({
                    message: `Join Nadma - Nampundwe's #1 services app! Use my referral code: ${referralCode}\n\nDownload now and find trusted local services.`,
                    title: 'Join Nadma',
                  });
                }}
                accessibilityLabel="Share referral code"
                accessibilityRole="button"
              >
                <Ionicons name="share" size={18} color="#fff" />
                <Text style={styles.referralShareText}>Share Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* About */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>More</Text>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('About'); }} accessibilityLabel="About" accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="info" size={20} color={colors.info} />
            </View>
            <Text style={styles.menuItemText}>About</Text>
            <View style={styles.menuRight}>
              <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { hapticLight(); navigation.navigate('settings'); }} accessibilityLabel="Settings" accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="settings" size={20} color={colors.primary} />
            </View>
            <Text style={styles.menuItemText}>Settings</Text>
            <View style={styles.menuRight}>
              <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout} accessibilityLabel="Sign out" accessibilityRole="button">
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Nadma v1.0.0</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
