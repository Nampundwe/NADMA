import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  sendMessage,
  getConversation,
  markMessagesRead,
  getCurrentUser,
} from '../data/storage';
import { useTheme } from '../context/ThemeContext';
import { hapticMedium } from '../utils/haptics';

export default function ChatScreen({ route }) {
  const { colors } = useTheme();
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
  const flatListRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const otherName =
    conversationType === 'business'
      ? businessName
      : receiverName;

  useEffect(() => {
    getCurrentUser().then(async (u) => {
      setUser(u);
      if (u) {
        await loadMessages(u.id);
        markMessagesRead(u.id, receiverId || businessId);
      }
      setLoading(false);
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!user) return;
      const interval = setInterval(() => {
        if (user) loadMessages(user.id);
      }, 3000);
      return () => clearInterval(interval);
    }, [user])
  );

  const loadMessages = async (userId) => {
    const data = await getConversation(userId, receiverId || businessId);
    setMessages(data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;

    hapticMedium();
    Keyboard.dismiss();

    const otherId = receiverId || businessId;

    const message = {
      id: 'msg_' + Date.now(),
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

    await sendMessage(message);
    setInputText('');
    loadMessages(user.id);
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === user?.id;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View style={{ opacity }}>
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myMessage : styles.theirMessage,
          ]}
        >
          {!isMine && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
          <View style={[styles.timeRow, isMine && styles.timeRowMine]}>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.myTime : styles.theirTime,
              ]}
            >
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isMine && (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.read ? '#90caf9' : '#c5cae9'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </Animated.View>
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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={conversationType === 'admin' ? 'shield' : conversationType === 'user' ? 'person' : 'storefront'}
            size={22}
            color="#fff"
          />
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{otherName}</Text>
              {messages.length > 0 && (
                <View style={styles.onlineDot} />
              )}
            </View>
            {conversationType === 'admin' && (
              <Text style={styles.headerSubtitle}>Admin Support</Text>
            )}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={conversationType === 'admin' ? 'help-circle' : 'chatbubbles'}
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>
                {conversationType === 'admin'
                  ? 'Contact Admin Support'
                  : `Start a conversation with ${otherName}`}
              </Text>
              {conversationType === 'admin' && (
                <Text style={styles.emptySubtext}>
                  Ask questions, report issues, or get help
                </Text>
              )}
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 14,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.headerText,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#c5cae9',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.borderLight,
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: colors.text,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeRowMine: {
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 10,
  },
  myTime: {
    color: '#c5cae9',
  },
  theirTime: {
    color: colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
