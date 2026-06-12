import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getJson, postJson, getAdminToken } from '@/utils/api';

export default function ChatScreen() {
  const queryClient = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Fetch conversations
  const { data: convsData, isLoading: loadingConvs, isError: convsError, refetch: refetchConvs } = useQuery({
    queryKey: ['admin-conversations'],
    queryFn: () => getJson('/api/admin/whatsapp-inbox/conversations'),
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const conversations = convsData?.conversations || [];

  // 2. Fetch messages for selected conversation
  const { data: msgsData, refetch: refetchMsgs } = useQuery({
    queryKey: ['admin-messages', selectedConv?.phone],
    queryFn: () => {
      if (!selectedConv?.phone) return { messages: [] };
      return getJson(`/api/admin/whatsapp-inbox/messages?phone=${encodeURIComponent(selectedConv.phone)}`);
    },
    enabled: !!selectedConv?.phone,
    refetchInterval: 5000, // Poll every 5 seconds when active
  });

  const messages = msgsData?.messages
    ? msgsData.messages.filter(
        (msg: any) =>
          msg.phone !== 'DEBUG' &&
          msg.phone !== 'WEBHOOK_TEST' &&
          msg.phone !== 'MANUAL_TEST' &&
          msg.message_type !== 'debug_raw_payload' &&
          msg.message_type !== 'test_payload' &&
          msg.message_type !== 'manual_test'
      )
    : [];

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Mutation to send WhatsApp reply
  const sendReplyMutation = useMutation({
    mutationFn: (text: string) =>
      postJson('/api/admin/whatsapp-inbox/send-reply', {
        phone: selectedConv?.phone,
        message: text,
      }),
    onSuccess: () => {
      setReplyText('');
      refetchMsgs();
      refetchConvs();
    },
    onError: (err: any) => {
      alert(`Failed to send message: ${err?.message || err}`);
    },
  });

  const handleSend = () => {
    if (!replyText.trim()) return;
    sendReplyMutation.mutate(replyText.trim());
  };

  const handleQuickReply = (text: string) => {
    setReplyText(text);
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Render conversation item in list
  const renderConvItem = ({ item }: { item: any }) => {
    const isUnread = item.unread_count > 0;
    
    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => setSelectedConv(item)}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color="#3b82f6" />
        </View>

        <View style={styles.convBody}>
          <View style={styles.convHeader}>
            <Text style={[styles.convName, isUnread && styles.textBold]}>
              {item.customer_name || 'Unknown Customer'}
            </Text>
            <Text style={styles.convTime}>
              {formatTime(item.last_message_at)}
            </Text>
          </View>
          
          <View style={styles.convFooter}>
            <Text style={[styles.lastMsg, isUnread && styles.textActive]} numberOfLines={1}>
              {item.last_message || 'No messages yet'}
            </Text>
            {isUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
          <Text style={styles.convPhone}>{item.phone}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Master view: List of conversations
  if (!selectedConv) {
    return (
      <View style={styles.container}>
        {loadingConvs ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={64} color="#334155" />
            <Text style={styles.emptyText}>No conversations yet</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConvItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContainer}
            onRefresh={refetchConvs}
            refreshing={loadingConvs}
          />
        )}
      </View>
    );
  }

  // Detail view: Chat message thread
  return (
    <SafeAreaViewContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.chatContainer}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelectedConv(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{selectedConv.customer_name || 'Unknown Customer'}</Text>
            <Text style={styles.headerSubtitle}>{selectedConv.phone}</Text>
          </View>
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.threadScroll}
          contentContainerStyle={styles.threadContent}
        >
          {messages.length === 0 ? (
            <View style={styles.noMessagesContainer}>
              <Text style={styles.noMessagesText}>No messages in this chat yet</Text>
            </View>
          ) : (
            messages.map((msg: any) => {
              const isOutbound = msg.direction === 'outbound';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.bubbleContainer,
                    isOutbound ? styles.outboundContainer : styles.inboundContainer,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isOutbound ? styles.outboundBubble : styles.inboundBubble,
                    ]}
                  >
                    <Text style={[styles.bubbleText, isOutbound ? styles.outboundText : styles.inboundText]}>
                      {msg.message_text}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        isOutbound ? styles.outboundTime : styles.inboundTime,
                      ]}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Quick Replies */}
        <View style={styles.quickRepliesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesScroll}>
            <TouchableOpacity
              style={styles.quickReplyBtn}
              onPress={() => handleQuickReply('Your order is being prepared.')}
            >
              <Text style={styles.quickReplyText}>Preparing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickReplyBtn}
              onPress={() => handleQuickReply('Your order is out for delivery.')}
            >
              <Text style={styles.quickReplyText}>Out for delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickReplyBtn}
              onPress={() => handleQuickReply('We are checking this for you. Will get back to you shortly.')}
            >
              <Text style={styles.quickReplyText}>Checking...</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Reply Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type a message..."
            placeholderTextColor="#64748b"
            multiline
            style={[styles.chatInput, { maxHeight: 100 }]}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !replyText.trim() && styles.sendBtnDisabled]}
            disabled={!replyText.trim() || sendReplyMutation.isPending}
            onPress={handleSend}
          >
            {sendReplyMutation.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaViewContainer>
  );
}

// Simple wrapper component to handle safe area on different screens
function SafeAreaViewContainer({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: '#0f172a' }}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
  },
  listContainer: {
    paddingVertical: 8,
  },
  convItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convBody: {
    flex: 1,
    marginLeft: 12,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  convTime: {
    color: '#64748b',
    fontSize: 12,
  },
  convFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMsg: {
    color: '#94a3b8',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  convPhone: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  textBold: {
    fontWeight: '800',
    color: '#ffffff',
  },
  textActive: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    paddingRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  threadScroll: {
    flex: 1,
    backgroundColor: '#0b1329', // Slightly darker backdrop for chat bubbles
  },
  threadContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  noMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noMessagesText: {
    color: '#64748b',
    fontSize: 14,
  },
  bubbleContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  outboundContainer: {
    justifyContent: 'flex-end',
  },
  inboundContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  outboundBubble: {
    backgroundColor: '#3b82f6', // Blue 500
    borderBottomRightRadius: 2,
  },
  inboundBubble: {
    backgroundColor: '#1e293b', // Slate 800
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  outboundText: {
    color: '#ffffff',
  },
  inboundText: {
    color: '#e2e8f0',
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  outboundTime: {
    color: '#93c5fd', // Blue 300
  },
  inboundTime: {
    color: '#64748b',
  },
  quickRepliesContainer: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingVertical: 10,
  },
  quickRepliesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickReplyBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  quickReplyText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#475569',
  },
});
