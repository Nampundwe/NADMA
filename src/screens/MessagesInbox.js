import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  StatusBar,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  onConversationsSnapshot,
  getCurrentUser,
  getAllUsers,
  onUserStatusSnapshot,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { createStyleSheet } from '../utils/responsive';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'business', label: 'Business' },
  { key: 'admin', label: 'Admin' },
  { key: 'user', label: 'Users' },
];

export default function MessagesInbox({ navigation }) {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const unsubsRef = useRef([]);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        getAllUsers().then((users) => {
          setAllUsers(users.filter((usr) => usr.id !== u.id));
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    unsubsRef.current.forEach((fn) => fn());
    unsubsRef.current = [];
    const filterType = filter === 'all' ? null : filter;
    const unsub = onConversationsSnapshot(user.id, (convos) => {
      setConversations(convos);
    }, filterType);
    unsubsRef.current.push(unsub);
    return () => {
      unsubsRef.current.forEach((fn) => fn());
      unsubsRef.current = [];
    };
  }, [user?.id, filter]);

  useEffect(() => {
    const userIds = conversations.map((c) => c.otherId).filter(Boolean);
    const newUnsubs = [];
    userIds.forEach((uid) => {
      if (uid === 'admin') return;
      const unsub = onUserStatusSnapshot(uid, (status) => {
        setOnlineStatuses((prev) => ({ ...prev, [uid]: status?.isOnline === true }));
      });
      newUnsubs.push(unsub);
    });
    return () => newUnsubs.forEach((fn) => fn());
  }, [conversations]);

  const openChat = (conv) => {
    navigation.navigate('Chat', {
      businessId: conv.conversationType === 'business' ? conv.businessId : undefined,
      businessName: conv.conversationType === 'business' ? conv.businessName : undefined,
      receiverId: conv.otherId,
      receiverName: conv.otherName || conv.businessName || 'Unknown',
      conversationType: conv.conversationType,
    });
  };

  const startAdminChat = () => {
    setShowNewChat(false);
    navigation.navigate('Chat', {
      receiverId: 'admin',
      receiverName: 'Admin Support',
      conversationType: 'admin',
    });
  };

  const startUserChat = (usr) => {
    setShowNewChat(false);
    navigation.navigate('Chat', {
      receiverId: usr.id,
      receiverName: usr.name,
      conversationType: 'user',
    });
  };

  const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const renderConversation = useCallback(({ item }) => {
    const isOnline = onlineStatuses[item.otherId] === true;
    const displayName = item.otherName || item.businessName || 'Unknown';
    return (
      <Pressable
        style={[styles.convRow, { borderBottomColor: colors.border }]}
        onPress={() => openChat(item)}
      >
        <View style={[styles.convAvatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.convAvatarText, { color: colors.primary }]}>
            {getInitials(displayName)}
          </Text>
          {isOnline && <View style={[styles.convOnlineDot, { backgroundColor: '#4CAF50' }]} />}
        </View>
        <View style={styles.convBody}>
          <View style={styles.convTopRow}>
            <Text style={[styles.convName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.convTime, { color: colors.chatTime }]}>
              {item.lastMessage?.timestamp
                ? new Date(item.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </Text>
          </View>
          <View style={styles.convBottomRow}>
            <Text style={[styles.convPreview, { color: colors.chatPreview }]} numberOfLines={1}>
              {item.lastMessage?.text || 'No messages yet'}
            </Text>
            {item.unread > 0 && (
              <View style={[styles.convBadge, { backgroundColor: colors.chatUnreadBg }]}>
                <Text style={styles.convBadgeText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  }, [onlineStatuses, colors]);

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Messages</Text>
      </View>

      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && [styles.filterTabActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => setFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterLabel,
                { color: filter === tab.key ? '#fff' : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.otherId}
        contentContainerStyle={conversations.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.chatDatePill }]}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.chatSendBtn} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.chatDateText }]}>No conversations</Text>
            <Text style={[styles.emptySubtitle, { color: colors.chatTime }]}>
              Start a new conversation below
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.chatSendBtn }]}
        onPress={() => setShowNewChat(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="create" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showNewChat} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewChat(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Conversation</Text>

            {user?.role !== 'admin' && (
              <Pressable style={[styles.modalOption, { backgroundColor: colors.inputBg }]} onPress={startAdminChat}>
                <View style={[styles.modalOptionIcon, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="shield" size={22} color="#F44336" />
                </View>
                <View style={styles.modalOptionInfo}>
                  <Text style={[styles.modalOptionName, { color: colors.text }]}>Admin Support</Text>
                  <Text style={[styles.modalOptionSub, { color: colors.textMuted }]}>Get help from admin</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            )}

            {allUsers.filter((u) => u.role !== 'admin').length > 0 && (
              <Text style={[styles.modalSection, { color: colors.textMuted }]}>USERS</Text>
            )}
            {allUsers.filter((u) => u.role !== 'admin').map((usr) => (
              <Pressable
                key={usr.id}
                style={[styles.modalOption, { backgroundColor: colors.inputBg }]}
                onPress={() => startUserChat(usr)}
              >
                <View style={[styles.modalOptionAvatar, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.modalOptionAvatarText, { color: colors.primary }]}>
                    {getInitials(usr.name)}
                  </Text>
                </View>
                <View style={styles.modalOptionInfo}>
                  <Text style={[styles.modalOptionName, { color: colors.text }]}>{usr.name}</Text>
                  <Text style={[styles.modalOptionSub, { color: colors.textMuted }]}>{usr.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => createStyleSheet({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterTabActive: {},
  filterLabel: { fontSize: 13, fontWeight: '600' },
  list: { paddingBottom: 80 },
  emptyList: { flex: 1 },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  convAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  convAvatarText: { fontSize: 17, fontWeight: 'bold' },
  convOnlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  convBody: { flex: 1 },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  convTime: { fontSize: 11 },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convPreview: { fontSize: 13, flex: 1, marginRight: 8 },
  convBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  convBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptySubtitle: { fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalSection: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
    gap: 12,
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionAvatarText: { fontSize: 15, fontWeight: 'bold' },
  modalOptionInfo: { flex: 1 },
  modalOptionName: { fontSize: 14, fontWeight: '600' },
  modalOptionSub: { fontSize: 12, marginTop: 1 },
});
