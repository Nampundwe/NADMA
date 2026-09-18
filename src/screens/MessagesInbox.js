import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  StatusBar,
  ActivityIndicator,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MessagesSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = async () => {
    setRefreshing(true);
    const u = await getCurrentUser();
    setUser(u);
    setRefreshing(false);
  };

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
    if (!allUsers.length) return;
    const newUnsubs = [];
    allUsers.forEach((usr) => {
      const unsub = onUserStatusSnapshot(usr.id, (status) => {
        const lastSeenTime = status?.lastSeen ? new Date(status.lastSeen).getTime() : 0;
        const isOnline = status?.isOnline === true && (Date.now() - lastSeenTime) < 120000;
        setOnlineStatuses((prev) => ({ ...prev, [usr.id]: isOnline }));
      });
      newUnsubs.push(unsub);
    });
    return () => newUnsubs.forEach((fn) => fn());
  }, [allUsers]);

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

  const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '';

  const formatConvTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const userMap = {};
  allUsers.forEach((u) => { userMap[u.id] = u; });

  const renderAvatar = (userId, size = 50) => {
    const usr = userMap[userId];
    const img = usr?.profileImage;
    const name = usr?.name || 'Unknown';
    return (
      <View style={[styles.convAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryLight }]}>
        {img ? (
          <Image source={{ uri: img }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <Text style={[styles.convAvatarText, { color: colors.primary, fontSize: size * 0.36 }]}>
            {getInitials(name)}
          </Text>
        )}
      </View>
    );
  };

  const renderConversation = useCallback(({ item }) => {
    const isOnline = onlineStatuses[item.otherId] === true;
    const displayName = item.otherName || item.businessName || 'Unknown';
    const isMyLastMsg = item.lastMessage?.senderId === user?.id;
    const previewText = item.lastMessage?.imageUrl
      ? '📷 Photo'
      : item.lastMessage?.text || 'No messages yet';
    return (
      <Pressable
        style={[styles.convRow, { borderBottomColor: colors.border }]}
        onPress={() => openChat(item)}
      >
        <View>
          {renderAvatar(item.otherId, 54)}
          {isOnline && <View style={[styles.convOnlineDot, { backgroundColor: colors.success }]} />}
        </View>
        <View style={styles.convBody}>
          <View style={styles.convTopRow}>
            <Text style={[styles.convName, { color: colors.text, fontWeight: item.unread > 0 ? '700' : '600' }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.convTime, { color: item.unread > 0 ? colors.success : colors.chatTime }]}>
              {formatConvTime(item.lastMessage?.timestamp)}
            </Text>
          </View>
          <View style={styles.convBottomRow}>
            <Text style={[styles.convPreview, { color: item.unread > 0 ? colors.text : colors.chatPreview, fontWeight: item.unread > 0 ? '600' : '400' }]} numberOfLines={1}>
              {isMyLastMsg ? `You: ${previewText}` : previewText}
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
  }, [onlineStatuses, colors, userMap, user?.id]);

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        const name = (c.otherName || c.businessName || '').toLowerCase();
        const lastText = (c.lastMessage?.text || '').toLowerCase();
        return name.includes(q) || lastText.includes(q);
      })
    : conversations;

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <MessagesSkeleton />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Messages</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
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
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.otherId}
        contentContainerStyle={filteredConversations.length === 0 ? styles.emptyList : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        ListHeaderComponent={
          allUsers.filter((u) => onlineStatuses[u.id]).length > 0 ? (
            <View style={styles.activeSection}>
              <Text style={[styles.activeSectionTitle, { color: colors.text }]}>Active now</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={allUsers.filter((u) => onlineStatuses[u.id])}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.activeList}
                renderItem={({ item: usr }) => (
                  <TouchableOpacity
                    style={styles.activeUser}
                    onPress={() => startUserChat(usr)}
                    activeOpacity={0.7}
                  >
                    <View>
                      {usr.profileImage ? (
                        <Image source={{ uri: usr.profileImage }} style={[styles.activeAvatar]} />
                      ) : (
                        <View style={[styles.activeAvatar, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.activeAvatarText, { color: colors.primary }]}>
                            {getInitials(usr.name)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                    </View>
                    <Text style={[styles.activeUserName, { color: colors.text }]} numberOfLines={1}>
                      {usr.name?.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations"
            subtitle="Start a new conversation below"
          />
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.chatSendBtn }]}
        onPress={() => setShowNewChat(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="pencil" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showNewChat} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewChat(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Conversation</Text>

            {user?.role !== 'admin' && (
              <Pressable style={[styles.modalOption, { backgroundColor: colors.inputBg }]} onPress={startAdminChat}>
                <View style={[styles.modalOptionIcon, { backgroundColor: colors.dangerLight }]}>
                  <Ionicons name="shield" size={22} color={colors.danger} />
                </View>
                <View style={styles.modalOptionInfo}>
                  <Text style={[styles.modalOptionName, { color: colors.text }]}>Admin Support</Text>
                  <Text style={[styles.modalOptionSub, { color: colors.textMuted }]}>Get help from admin</Text>
                </View>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
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
                {usr.profileImage ? (
                  <Image source={{ uri: usr.profileImage }} style={[styles.modalOptionAvatar]} />
                ) : (
                  <View style={[styles.modalOptionAvatar, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.modalOptionAvatarText, { color: colors.primary }]}>
                      {getInitials(usr.name)}
                    </Text>
                  </View>
                )}
                <View style={styles.modalOptionInfo}>
                  <Text style={[styles.modalOptionName, { color: colors.text }]}>{usr.name}</Text>
                  <Text style={[styles.modalOptionSub, { color: colors.textMuted }]}>{usr.email}</Text>
                </View>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
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
  activeSection: { paddingTop: 12, paddingBottom: 8 },
  activeSectionTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, marginBottom: 10 },
  activeList: { paddingHorizontal: 16, gap: 16 },
  activeUser: { alignItems: 'center', width: 60 },
  activeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeAvatarText: { fontSize: 16, fontWeight: 'bold' },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  activeUserName: { fontSize: 11, textAlign: 'center' },
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
