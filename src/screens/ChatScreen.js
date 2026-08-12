import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  sendMessage,
  markMessagesRead,
  getCurrentUser,
  onMessagesSnapshot,
  onUserStatusSnapshot,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticMedium } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';

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

export default function ChatScreen({ route }) {
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
  const [selectedMsg, setSelectedMsg] = useState(null);
  const flatListRef = useRef(null);

  const otherName = conversationType === 'business' ? businessName : receiverName;
  const otherId = receiverId;

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!otherId || otherId === 'admin') return;
    const unsub = onUserStatusSnapshot(otherId, (status) => {
      setOtherOnline(status?.isOnline === true);
    });
    return () => unsub();
  }, [otherId]);

  useEffect(() => {
    if (!user) return;
    let targetId = otherId;
    if (targetId === 'admin') {
      targetId = 'admin';
    }
    const unsubscribe = onMessagesSnapshot(user.id, targetId, (msgs) => {
      setMessages(msgs);
      if (user && targetId !== 'admin') {
        markMessagesRead(targetId, user.id);
      }
    });
    return () => unsubscribe();
  }, [user?.id, otherId]);

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;
    hapticMedium();
    Keyboard.dismiss();
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
    };
    setInputText('');
    const result = await sendMessage(msg);
    if (result !== true && result?.success === false) {
      toast.error(result.error || 'Failed to send');
    }
  };

  const handleLongPress = (item) => {
    hapticMedium();
    setSelectedMsg(selectedMsg?.id === item.id ? null : item);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
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

    return (
      <View>
        {showDate && renderDateSeparator(formatDateSeparator(item.timestamp))}
        <Pressable
          onLongPress={() => handleLongPress(item)}
          onPress={() => selectedMsg && setSelectedMsg(null)}
          style={[
            styles.messageWrapper,
            isMine ? styles.messageWrapperMine : styles.messageWrapperTheirs,
          ]}
        >
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
        </Pressable>
      </View>
    );
  }, [user?.id, messages, selectedMsg, colors]);

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.chatBg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
              {otherName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: otherOnline ? '#4CAF50' : colors.textMuted }]}>
              {otherOnline ? 'online' : (conversationType === 'admin' ? 'Admin Support' : 'offline')}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {otherOnline && <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />}
        </View>
      </View>

      {selectedMsg && (
        <View style={[styles.selectionBar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.selectionText, { color: colors.text }]} numberOfLines={1}>
            {selectedMsg.text}
          </Text>
          <TouchableOpacity onPress={() => setSelectedMsg(null)}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.chatDatePill }]}>
                <Ionicons name="chatbubbles" size={36} color={colors.chatSendBtn} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.chatDateText }]}>
                Start a conversation
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.chatTime }]}>
                Messages are end-to-end private
              </Text>
            </View>
          }
        />

        <View style={[styles.inputBar, { backgroundColor: colors.chatInputBg, borderTopColor: colors.chatInputBorder }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.chatInput }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.chatTime}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: { fontSize: 16, fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  headerRight: { width: 40, alignItems: 'flex-end' },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectionText: { flex: 1, fontSize: 14, marginRight: 8 },
  flex: { flex: 1 },
  messagesList: { padding: 12, paddingBottom: 8 },
  messageWrapper: { marginBottom: 2 },
  messageWrapperMine: { alignItems: 'flex-end' },
  messageWrapperTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bubbleMine: { borderTopRightRadius: 2 },
  bubbleTheirs: { borderTopLeftRadius: 2 },
  senderLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 2,
  },
  timeText: { fontSize: 10 },
  dateSeparatorContainer: { alignItems: 'center', marginVertical: 10 },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  datePillText: { fontSize: 11, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', paddingTop: 120 },
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
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
  },
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
});
