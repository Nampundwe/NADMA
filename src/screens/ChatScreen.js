import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressForChat } from '../utils/imageCompression';
import {
  sendMessage,
  deleteMessage,
  markMessagesRead,
  getCurrentUser,
  onMessagesSnapshot,
  onUserStatusSnapshot,
  getAllUsers,
  setTypingStatus,
  onTypingSnapshot,
  toggleMessageReaction,
  forwardMessage,
  uploadImage,
  blockUser,
  isBlocked,
  MESSAGE_REACTIONS,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticMedium, hapticLight } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';
import { ChatSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import * as Clipboard from 'expo-clipboard';

function formatDateSeparator(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function shouldShowDateSeparator(messages, index) {
  if (index === 0) return true;
  const curr = new Date(messages[index].timestamp).toDateString();
  const prev = new Date(messages[index - 1].timestamp).toDateString();
  return curr !== prev;
}

function formatLastSeen(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'Active just now';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Active ${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Active yesterday';
  return `Active ${diffDays}d ago`;
}

export default function ChatScreen({ route, navigation }) {
  const { colors } = useTheme();
  const toast = useToast();
  const {
    businessId,
    businessName,
    receiverId,
    receiverName,
    conversationType = 'business',
  } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otherOnline, setOtherOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [chatUserName, setChatUserName] = useState(receiverName || businessName || 'Unknown');
  const [otherProfileImage, setOtherProfileImage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [resolvedOtherId, setResolvedOtherId] = useState(receiverId);
  const [replyingTo, setReplyingTo] = useState(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (receiverId !== 'admin') return;
    getAllUsers().then((users) => {
      const admin = users.find((u) => u.role === 'admin');
      if (admin) {
        setResolvedOtherId(admin.id);
        setChatUserName(admin.name);
        setOtherProfileImage(admin.profileImage || null);
      }
    }).catch(() => {});
  }, []);

  const otherId = resolvedOtherId;
  const otherName = chatUserName;

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
      if (u && receiverId && receiverId !== 'admin' && receiverId === u.id) {
        toast.error("You can't chat with yourself");
        navigation.goBack();
      }
    });
  }, []);

  useEffect(() => {
    if (!otherId || otherId === 'admin') return;
    getAllUsers().then((users) => {
      setAllUsers(users.filter((u) => u.id !== user?.id));
      const found = users.find((u) => u.id === otherId);
      if (found) {
        setChatUserName(found.name);
        setOtherProfileImage(found.profileImage || null);
      }
    }).catch(() => {});
  }, [otherId, user?.id]);

  useEffect(() => {
    if (!otherId || otherId === 'admin') return;
    const unsub = onUserStatusSnapshot(otherId, (status) => {
      const lastSeenTime = status?.lastSeen ? new Date(status.lastSeen).getTime() : 0;
      const isRecentlyActive = status?.isOnline === true && (Date.now() - lastSeenTime) < 120000;
      setOtherOnline(isRecentlyActive);
      setLastSeen(status?.lastSeen || null);
    });
    return () => unsub();
  }, [otherId]);

  useEffect(() => {
    if (!user || !otherId) return;
    const chatId = [user.id, otherId].sort().join('_');
    const unsub = onTypingSnapshot(chatId, (typing) => {
      setTypingUsers(typing.filter((id) => id !== user.id));
    });
    return () => unsub();
  }, [user?.id, otherId]);

  useEffect(() => {
    if (!user) return;
    let targetId = otherId;
    const unsubscribe = onMessagesSnapshot(user.id, targetId, (msgs) => {
      setMessages(msgs);
      if (user && targetId !== 'admin') {
        markMessagesRead(targetId, user.id);
      }
    });
    return () => unsubscribe();
  }, [user?.id, otherId]);

  const handleTyping = useCallback(() => {
    if (!user || !otherId) return;
    const chatId = [user.id, otherId].sort().join('_');
    setTypingStatus(user.id, chatId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(user.id, chatId, false);
    }, 2000);
  }, [user?.id, otherId]);

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;
    hapticMedium();
    Keyboard.dismiss();
    const chatId = [user.id, otherId].sort().join('_');
    setTypingStatus(user.id, chatId, false);
    const msg = {
      senderId: user.id,
      senderName: user.name,
      receiverId: otherId,
      receiverName: otherName,
      businessId: businessId || null,
      businessName: businessName || null,
      conversationType,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      ...(replyingTo ? { replyTo: { id: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName } } : {}),
    };
    setInputText('');
    setReplyingTo(null);
    const result = await sendMessage(msg);
    if (result !== true && result?.success === false) {
      toast.error(result.error || 'Failed to send');
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleSendImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Camera roll access needed');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      hapticMedium();
      Keyboard.dismiss();
      setUploadingImage(true);
      toast.info('Uploading image...');
      let uploadUrl;
      try {
        const asset = result.assets[0];
        uploadUrl = await uploadImage(`chat-images/${user.id}_${Date.now()}.jpg`, asset.uri);
      } catch (uploadErr) {
        console.warn('Chat image upload error:', uploadErr?.message || uploadErr);
      }
      if (!uploadUrl) {
        toast.error('Failed to upload image');
        setUploadingImage(false);
        return;
      }
      const msg = {
        senderId: user.id,
        senderName: user.name,
        receiverId: otherId,
        receiverName: otherName,
        businessId: businessId || null,
        businessName: businessName || null,
        conversationType,
        text: '',
        imageUrl: uploadUrl,
        timestamp: new Date().toISOString(),
        read: false,
      };
      await sendMessage(msg);
      setUploadingImage(false);
    } catch (err) {
      console.warn('handleSendImage error:', err?.message || err);
      toast.error('Failed to send image');
      setUploadingImage(false);
    }
  };

  const handleLongPress = (item) => {
    hapticMedium();
    setSelectedMsg(selectedMsg?.id === item.id ? null : item);
    setReactionPickerMsg(null);
  };

  const handleMessageReaction = (msgId, emoji) => {
    hapticLight();
    toggleMessageReaction(msgId, user.id, emoji);
    setReactionPickerMsg(null);
    setSelectedMsg(null);
  };

  const handleCopy = async () => {
    if (!selectedMsg?.text) return;
    await Clipboard.setStringAsync(selectedMsg.text);
    toast.success('Message copied');
    setSelectedMsg(null);
  };

  const handleDelete = async () => {
    if (!selectedMsg) return;
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteMessage(selectedMsg.id);
          if (ok) {
            setMessages((prev) => prev.filter((m) => m.id !== selectedMsg.id));
          } else {
            toast.error('Failed to delete');
          }
          setSelectedMsg(null);
        },
      },
    ]);
  };

  const handleForward = (msg) => {
    setForwardMessage(msg);
    setForwardModalVisible(true);
    setSelectedMsg(null);
  };

  const handleBlock = () => {
    if (!user || !otherId) return;
    Alert.alert('Block User', `Are you sure you want to block ${otherName}? They won't be able to message you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const ok = await blockUser(user.id, otherId);
          if (ok) {
            toast.success(`${otherName} has been blocked`);
            navigation.goBack();
          } else {
            toast.error('Failed to block user');
          }
        },
      },
    ]);
  };

  const handleForwardToUser = async (usr) => {
    if (!forwardMessage) return;
    const chatId = [user.id, usr.id].sort().join('_');
    const result = await sendMessage({
      senderId: user.id,
      senderName: user.name,
      receiverId: usr.id,
      receiverName: usr.name,
      conversationType: 'user',
      text: forwardMessage.text,
      imageUrl: forwardMessage.imageUrl || null,
      forwarded: true,
      timestamp: new Date().toISOString(),
      read: false,
    });
    setForwardModalVisible(false);
    setForwardMessage(null);
    if (result) toast.success(`Forwarded to ${usr.name}`);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const onScroll = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const contentHeight = e.nativeEvent.contentSize.height;
    const layoutHeight = e.nativeEvent.layoutMeasurement.height;
    setShowScrollBtn(contentHeight - offsetY - layoutHeight > 200);
  };

  const renderDateSeparator = (dateStr) => (
    <View style={styles.dateSeparatorContainer}>
      <View style={[styles.datePill, { backgroundColor: colors.chatDatePill }]}>
        <Text style={[styles.datePillText, { color: colors.chatDateText }]}>{dateStr}</Text>
      </View>
    </View>
  );

  const renderMessage = useCallback(({ item, index }) => {
    const isMine = item.senderId === user?.id;
    const showDate = shouldShowDateSeparator(messages, index);
    const reactions = item.reactions || {};
    const reactionEntries = Object.entries(reactions);
    const msgReactions = {};
    reactionEntries.forEach(([uid, emoji]) => {
      if (!msgReactions[emoji]) msgReactions[emoji] = [];
      msgReactions[emoji].push(uid);
    });

    return (
      <View>
        {showDate && renderDateSeparator(formatDateSeparator(item.timestamp))}
        <Pressable
          onLongPress={() => handleLongPress(item)}
          onPress={() => {
            if (selectedMsg) setSelectedMsg(null);
            else if (reactionPickerMsg) setReactionPickerMsg(null);
          }}
          style={[
            styles.messageWrapper,
            isMine ? styles.messageWrapperMine : styles.messageWrapperTheirs,
          ]}
        >
          {item.forwarded && (
            <Text style={[styles.forwardedLabel, { color: colors.chatTime }]}>
              <Ionicons name="repeat" size={11} /> Forwarded
            </Text>
          )}
          {item.replyTo && (
            <View style={[styles.replyPreview, { backgroundColor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderLeftColor: colors.primary }]}>
              <Text style={[styles.replyPreviewName, { color: colors.primary }]} numberOfLines={1}>
                {item.replyTo.senderName === user?.name ? 'You' : item.replyTo.senderName}
              </Text>
              <Text style={[styles.replyPreviewText, { color: colors.textMuted }]} numberOfLines={1}>
                {item.replyTo.text || 'Photo'}
              </Text>
            </View>
          )}
          {item.imageUrl ? (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, { backgroundColor: isMine ? colors.sentBubble : colors.receivedBubble, padding: 4 }]}>
              <Image
                source={{ uri: item.imageUrl }}
                style={[styles.chatImage, { backgroundColor: colors.inputBg || '#1a1a1a' }]}
                resizeMode="cover"
                onLoadStart={() => {}}
                onError={() => console.warn('Chat image failed to load:', item.imageUrl)}
              />
              {item.text ? (
                <Text style={[styles.bubbleText, { color: isMine ? colors.sentBubbleText : colors.receivedBubbleText, paddingHorizontal: 8, paddingTop: 4 }]}>
                  {item.text}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={[styles.timeText, { color: colors.chatTime }]}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.read ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={item.read ? colors.chatCheckRead : colors.chatCheckSent}
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.bubble,
                isMine
                  ? [styles.bubbleMine, { backgroundColor: colors.sentBubble }]
                  : [styles.bubbleTheirs, { backgroundColor: colors.receivedBubble }],
              ]}
            >
              {!isMine && (
                <Text style={[styles.senderLabel, { color: colors.info }]}>{item.senderName}</Text>
              )}
              <Text style={[styles.bubbleText, { color: isMine ? colors.sentBubbleText : colors.receivedBubbleText }]}>
                {item.text}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.timeText, { color: colors.chatTime }]}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.read ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={item.read ? colors.chatCheckRead : colors.chatCheckSent}
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            </View>
          )}
          {reactionEntries.length > 0 && (
            <View style={[styles.reactionBadges, isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              {Object.entries(msgReactions).map(([emoji, users]) => (
                <View key={emoji} style={[styles.reactionBadge, { backgroundColor: colors.card }]}>
                  <Text style={styles.reactionBadgeEmoji}>{emoji}</Text>
                  {users.length > 1 && <Text style={[styles.reactionBadgeCount, { color: colors.textMuted }]}>{users.length}</Text>}
                </View>
              ))}
            </View>
          )}
          {reactionPickerMsg === item.id && (
            <View style={[styles.msgReactionPicker, { backgroundColor: colors.card }]}>
              {MESSAGE_REACTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => handleMessageReaction(item.id, emoji)} style={styles.msgReactionOption}>
                  <Text style={styles.msgReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Pressable>
      </View>
    );
  }, [user?.id, messages, selectedMsg, reactionPickerMsg, colors]);

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ChatSkeleton />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.chatBg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, { backgroundColor: colors.primaryLight }]}>
            {otherProfileImage ? (
              <Image source={{ uri: otherProfileImage }} style={styles.headerAvatarImage} />
            ) : (
              <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
                {otherName?.charAt(0)?.toUpperCase() || ''}
              </Text>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: otherOnline ? colors.success : colors.textMuted }]}>
              {typingUsers.length > 0
                ? 'typing...'
                : otherOnline
                  ? 'Active now'
                  : lastSeen
                    ? formatLastSeen(lastSeen)
                    : (conversationType === 'admin' ? 'Admin Support' : '')}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {otherOnline && <View style={[styles.onlineIndicator, { backgroundColor: colors.success }]} />}
          {user && otherId && user.id !== otherId && conversationType !== 'admin' && (
            <TouchableOpacity onPress={handleBlock} style={{ marginLeft: 12 }}>
              <Ionicons name="ban-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selectedMsg && (
        <View style={[styles.selectionBar, { backgroundColor: colors.primaryLight }]}>
          <TouchableOpacity onPress={handleCopy} style={styles.selectionAction}>
            <Ionicons name="copy-outline" size={18} color={colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.primary }]}>Copy</Text>
          </TouchableOpacity>
          <View style={[styles.selectionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={() => { setReplyingTo(selectedMsg); setSelectedMsg(null); }} style={styles.selectionAction}>
            <Ionicons name="return-down-back-outline" size={18} color={colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.primary }]}>Reply</Text>
          </TouchableOpacity>
          <View style={[styles.selectionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={() => handleForward(selectedMsg)} style={styles.selectionAction}>
            <Ionicons name="arrow-forward-outline" size={18} color={colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.primary }]}>Forward</Text>
          </TouchableOpacity>
          <View style={[styles.selectionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={handleDelete} style={styles.selectionAction}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.selectionActionText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
          <View style={[styles.selectionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={() => setSelectedMsg(null)} style={styles.selectionAction}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onScroll={onScroll}
          onContentSizeChange={() => {
            if (!showScrollBtn) scrollToBottom();
          }}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles"
              title="Start a conversation"
              subtitle="Messages are end-to-end private"
            />
          }
        />

        {showScrollBtn && (
          <TouchableOpacity style={[styles.scrollBtn, { backgroundColor: colors.card }]} onPress={scrollToBottom}>
            <Ionicons name="chevron-down" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}

        {typingUsers.length > 0 && (
          <View style={[styles.typingBar, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.typingText, { color: colors.textMuted }]}>
              {otherName} is typing...
            </Text>
          </View>
        )}

        {replyingTo && (
          <View style={[styles.replyBar, { backgroundColor: colors.primaryLight, borderTopColor: colors.borderLight }]}>
            <Ionicons name="return-down-forward" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyBarName, { color: colors.primary }]} numberOfLines={1}>
                {replyingTo.senderName === user?.name ? 'You' : replyingTo.senderName}
              </Text>
              <Text style={[styles.replyBarText, { color: colors.text }]} numberOfLines={1}>
                {replyingTo.text || 'Photo'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.chatInputBg, borderTopColor: colors.chatInputBorder }]}>
          <TouchableOpacity onPress={handleSendImage} style={styles.imageBtn} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.chatInput }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.chatTime}
            value={inputText}
            onChangeText={(t) => { setInputText(t); handleTyping(); }}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: inputText.trim() ? colors.chatSendBtn : colors.textMuted },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={forwardModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Forward to</Text>
            <FlatList
              data={allUsers.filter((u) => u.role !== 'admin')}
              keyExtractor={(item) => item.id}
              renderItem={({ item: usr }) => (
                <TouchableOpacity style={[styles.forwardUser, { borderBottomColor: colors.border }]} onPress={() => handleForwardToUser(usr)}>
                  <View style={[styles.forwardAvatar, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.forwardAvatarText, { color: colors.primary }]}>{usr.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.forwardUserName, { color: colors.text }]}>{usr.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setForwardModalVisible(false)} style={styles.modalClose}>
              <Text style={[styles.modalCloseText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => createStyleSheet({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  backBtn: { marginRight: 4 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarText: { fontSize: 16, fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  headerRight: { width: 40, alignItems: 'flex-end' },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  selectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectionActionText: { fontSize: 12, fontWeight: '600' },
  selectionDivider: { width: 1, height: 18 },
  flex: { flex: 1 },
  messagesList: { padding: 12, paddingBottom: 8 },
  messageWrapper: { marginBottom: 2 },
  messageWrapperMine: { alignItems: 'flex-end' },
  messageWrapperTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  bubbleMine: { borderTopRightRadius: 4 },
  bubbleTheirs: { borderTopLeftRadius: 4 },
  senderLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  chatImage: { width: '100%', height: 200, borderRadius: 14 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 4,
    gap: 3,
  },
  timeText: { fontSize: 10 },
  forwardedLabel: { fontSize: 11, marginBottom: 2, fontStyle: 'italic' },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingBottom: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  replyPreviewName: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  replyPreviewText: { fontSize: 11 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  replyBarName: { fontSize: 12, fontWeight: '700' },
  replyBarText: { fontSize: 12 },
  reactionBadges: { flexDirection: 'row', gap: 4, marginTop: 2, paddingHorizontal: 4 },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  reactionBadgeEmoji: { fontSize: 14 },
  reactionBadgeCount: { fontSize: 10, fontWeight: '600' },
  msgReactionPicker: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
    gap: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  msgReactionOption: { paddingHorizontal: 4 },
  msgReactionEmoji: { fontSize: 24 },
  dateSeparatorContainer: { alignItems: 'center', marginVertical: 10 },
  datePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  datePillText: { fontSize: 11, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', paddingTop: 120 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptySubtitle: { fontSize: 13 },
  scrollBtn: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  typingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  typingText: { fontSize: 13, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
  },
  imageBtn: { padding: 8, marginRight: 4 },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 30, maxHeight: '60%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  forwardUser: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, gap: 12,
  },
  forwardAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  forwardAvatarText: { fontSize: 16, fontWeight: 'bold' },
  forwardUserName: { fontSize: 15, fontWeight: '500' },
  modalClose: { alignItems: 'center', paddingTop: 14 },
  modalCloseText: { fontSize: 16, fontWeight: '600' },
});
