import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AnimatedCard from '../components/AnimatedCard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getConversationsForUser,
  getConversationsForAdmin,
  getCurrentUser,
  getAllUsers,
} from '../data/storage';
import { useTheme } from '../context/ThemeContext';

export default function MessagesInbox({ navigation }) {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [user, setUser] = useState(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const emptyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(emptyOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getCurrentUser().then(async (u) => {
        setUser(u);
        if (u) {
          if (u.role === 'admin') {
            const convos = await getConversationsForAdmin(u.id);
            setConversations(convos);
          } else {
            const convos = await getConversationsForUser(u.id);
            setConversations(convos);
          }
          const users = await getAllUsers();
          setAllUsers(users.filter((usr) => usr.id !== u.id));
        }
        setLoading(false);
      });
    }, [])
  );

  const getIcon = (type) => {
    switch (type) {
      case 'admin': return 'shield';
      case 'user': return 'person';
      case 'business': return 'storefront';
      default: return 'chatbubbles';
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'admin': return '#F44336';
      case 'user': return '#2196F3';
      case 'business': return '#1a237e';
      default: return '#666';
    }
  };

  const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const startChatWithUser = (selectedUser) => {
    setShowNewChatModal(false);
    navigation.navigate('Chat', {
      receiverId: selectedUser.id,
      receiverName: selectedUser.name,
      conversationType: 'user',
    });
  };

  const renderConversation = ({ item }) => {
    const type = item.conversationType || 'business';
    const displayName = type === 'business' ? item.businessName : item.otherName;
    const color = getColor(type);

    return (
      <AnimatedCard
        style={styles.conversationCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('Chat', {
            businessId: type === 'business' ? item.businessId : undefined,
            businessName: type === 'business' ? item.businessName : undefined,
            receiverId: type === 'business' ? item.businessId : item.otherId,
            receiverName: displayName,
            conversationType: type,
          })
        }
        accessibilityLabel={`Chat with ${displayName}`}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: color + '18' }]}>
          <Text style={[styles.avatarText, { color }]}>{getInitials(displayName)}</Text>
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.businessName} numberOfLines={1}>{displayName}</Text>
            {type === 'admin' && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage.text}
          </Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.time}>
            {new Date(item.lastMessage.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </AnimatedCard>
    );
  };

  const styles = getStyles(colors);

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
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newChatBtn} onPress={() => setShowNewChatModal(true)} accessibilityLabel="Start new conversation" accessibilityRole="button">
          <Ionicons name="create-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.otherId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Animated.View style={{ opacity: emptyOpacity, alignItems: 'center', paddingTop: 80 }}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation from a service page{'\n'}or contact admin support
            </Text>
          </Animated.View>
        }
      />

      {/* New Chat Modal */}
      <Modal visible={showNewChatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Conversation</Text>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)} accessibilityLabel="Close" accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {user?.role !== 'admin' && (
              <TouchableOpacity
                style={styles.newChatOption}
                activeOpacity={0.7}
                onPress={() => {
                  setShowNewChatModal(false);
                  navigation.navigate('Chat', {
                    receiverId: 'admin',
                    receiverName: 'Admin Support',
                    conversationType: 'admin',
                  });
                }}
                accessibilityLabel="Chat with admin support"
                accessibilityRole="button"
              >
                <View style={[styles.optionIcon, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="shield" size={24} color="#F44336" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>Admin Support</Text>
                  <Text style={styles.optionSubtext}>Get help from the admin</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            {allUsers.length > 0 && (
              <>
                <Text style={styles.userSectionTitle}>Other Users</Text>
                {allUsers.filter((u) => u.role !== 'admin').map((usr) => (
                  <TouchableOpacity
                    key={usr.id}
                    style={styles.newChatOption}
                    activeOpacity={0.7}
                    onPress={() => startChatWithUser(usr)}
                    accessibilityLabel={`Chat with ${usr.name}`}
                    accessibilityRole="button"
                  >
                    <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
                      <Text style={styles.optionIconText}>{getInitials(usr.name)}</Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionName}>{usr.name}</Text>
                      <Text style={styles.optionSubtext}>{usr.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    backgroundColor: colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  newChatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
  conversationCard: {
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  adminBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adminBadgeText: {
    color: '#F44336',
    fontSize: 9,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  time: {
    fontSize: 11,
    color: colors.textMuted,
  },
  unreadBadge: {
    backgroundColor: '#1a237e',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    padding: 20,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  newChatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  optionSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  userSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
