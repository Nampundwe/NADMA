import React, { useState, useEffect } from 'react';
import {
  View,
  Text,

  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import AnimatedCard from '../components/AnimatedCard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  markNotificationRead,
  markAllNotificationsRead,
  getCurrentUser,
  onNotificationsSnapshot,
} from '../data/firebaseStorage';
import { hapticLight } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    let unsubscribe;
    getCurrentUser().then((u) => {
      setUser(u);
      if (u) {
        unsubscribe = onNotificationsSnapshot(u.id, (data) => {
          setNotifications(data);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    hapticLight();
    for (const n of notifications.filter((n) => !n.read)) {
      await markNotificationRead(n.id);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handlePress = async (notif) => {
    hapticLight();
    await markNotificationRead(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    try {
      if (notif.type === 'message') {
        navigation.navigate('MessagesInbox');
      } else if (notif.type === 'booking_update' || notif.type === 'new_booking') {
        navigation.navigate('MyBookings');
      } else if (notif.type === 'post_comment' || notif.type === 'post_like' || notif.type === 'news') {
        const rootNav = navigation.getParent()?.getParent();
        if (rootNav) {
          rootNav.navigate('Community');
        }
      }
    } catch (e) {
      try {
        const rootNav = navigation.getParent()?.getParent();
        if (rootNav) rootNav.navigate('Home');
      } catch (e2) {}
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'booking_update': return 'calendar';
      case 'business_update': return 'storefront';
      case 'new_booking': return 'document-text';
      case 'message': return 'chatbubbles';
      case 'post_comment': return 'chatbubble';
      case 'post_like': return 'heart';
      case 'news': return 'megaphone';
      default: return 'notifications';
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'booking_update': return '#FF9800';
      case 'business_update': return '#4CAF50';
      case 'new_booking': return '#1a237e';
      case 'message': return '#2196F3';
      case 'post_comment': return '#9C27B0';
      case 'post_like': return '#F44336';
      case 'news': return '#D32F2F';
      default: return '#6B7280';
    }
  };

  const renderNotification = ({ item }) => {
    const color = getColor(item.type);
    return (
      <AnimatedCard
        style={[styles.notifCard, !item.read && styles.unreadCard]}
        activeOpacity={0.7}
        onPress={() => handlePress(item)}
        accessibilityLabel={`${item.title}. ${item.message}${!item.read ? '. Unread' : ''}`}
        accessibilityRole="button"
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
          <Ionicons name={getIcon(item.type)} size={22} color={color} />
        </View>
        <View style={styles.notifInfo}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]}>
            {item.title}
          </Text>
          <Text style={styles.notifMessage}>{item.message}</Text>
          <Text style={styles.notifTime}>
            {new Date(item.timestamp).toLocaleDateString()} at{' '}
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </AnimatedCard>
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead} accessibilityLabel="Mark all as read" accessibilityRole="button">
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.markAllBtnText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={40} color="#C4C4C4" />
            </View>
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    backgroundColor: colors.headerBg,
    padding: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.headerText,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#C5CAE9',
    marginTop: 2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  markAllBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
  notifCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#EDE7F6',
    borderLeftWidth: 3,
    borderLeftColor: '#1a237e',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notifInfo: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  unreadTitle: {
    fontWeight: 'bold',
    color: '#1a237e',
  },
  notifMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1a237e',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
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
    textAlign: 'center',
    lineHeight: 20,
  },
});
