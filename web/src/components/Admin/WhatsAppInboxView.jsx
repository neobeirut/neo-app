"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  MapPin,
  Settings,
} from "lucide-react";

export default function WhatsAppInboxView({ adminToken }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [adminBranchName, setAdminBranchName] = useState(null);
  const [infobipConfig, setInfobipConfig] = useState(null);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
    fetchAdminInfo();
    checkInfobipConfig();
    // Poll for new conversations every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch admin info to show branch context
  const fetchAdminInfo = async () => {
    try {
      const res = await fetch("/api/admin-users/session", {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      if (data.ok && data.admin) {
        setAdminBranchName(data.admin.branch_name || "All Branches");
      } else if (data.admin) {
        // Handle case where ok is not present
        setAdminBranchName(data.admin.branch_name || "All Branches");
      }
    } catch (err) {
      console.error("Failed to fetch admin info:", err);
    }
  };

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.phone);
      // Poll for new messages every 5 seconds when viewing a conversation
      const interval = setInterval(
        () => fetchMessages(selectedConversation.phone),
        5000
      );
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/admin/whatsapp-inbox/conversations", {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      if (data.ok) {
        setConversations(data.conversations);
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      setError("Failed to load conversations");
      setLoading(false);
    }
  };

  const fetchMessages = async (phone) => {
    try {
      const res = await fetch(
        `/api/admin/whatsapp-inbox/messages?phone=${encodeURIComponent(phone)}`,
        {
          headers: { "x-admin-token": adminToken },
        }
      );
      const data = await res.json();
      if (data.ok) {
        // Filter out debug and test messages
        const realMessages = data.messages.filter(
          (msg) =>
            msg.phone !== "DEBUG" &&
            msg.phone !== "WEBHOOK_TEST" &&
            msg.phone !== "MANUAL_TEST" &&
            msg.message_type !== "debug_raw_payload" &&
            msg.message_type !== "test_payload" &&
            msg.message_type !== "manual_test"
        );
        setMessages(realMessages);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const sendReply = async () => {
    console.log("🟢 SEND REPLY FUNCTION STARTED");
    if (!replyText.trim() || !selectedConversation) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/whatsapp-inbox/send-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          phone: selectedConversation.phone,
          message: replyText,
        }),
      });

      const text = await res.text();
      console.log("🔥 SEND-REPLY RAW RESPONSE:", text);

      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("❌ Response is not JSON:", e);
      }

      console.log("🔥 DEBUG PAYLOAD FROM SERVER:", data.debugPayload);
      console.log("🔥 SEND-REPLY ERROR:", data.error);

      if (data.ok) {
        setReplyText("");
        // Refresh messages
        await fetchMessages(selectedConversation.phone);
        // Refresh conversations to update last message
        await fetchConversations();
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text) => {
    setReplyText(text);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const checkInfobipConfig = async () => {
    try {
      const res = await fetch("/api/admin/test-infobip-config", {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      setInfobipConfig(data);
    } catch (err) {
      console.error("Failed to check Infobip config:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Configuration Warning */}
      {infobipConfig && !infobipConfig.configured && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-600" />
              <span className="font-medium text-red-900">
                WhatsApp not configured - {infobipConfig.error}
              </span>
            </div>
            <button
              onClick={() => (window.location.href = "/admin/whatsapp-setup")}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
            >
              <Settings size={16} />
              Setup Guide
            </button>
          </div>
        </div>
      )}

      {/* Branch Context Indicator */}
      {adminBranchName && (
        <div className="bg-purple-50 border-b border-purple-200 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-purple-600" />
            <span className="font-medium text-purple-900">
              Viewing: {adminBranchName}
            </span>
          </div>
        </div>
      )}

      {/* Main Inbox Container */}
      <div className="flex flex-1 bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Conversations List */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare size={20} />
              WhatsApp Inbox
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {conversations.length} conversation
              {conversations.length !== 1 ? "s" : ""}
            </p>
          </div>

          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
              {infobipConfig && !infobipConfig.configured ? (
                <>
                  <p className="font-semibold text-gray-700 mb-2">
                    Setup Required
                  </p>
                  <p className="text-sm mb-4">
                    WhatsApp inbox needs to be configured
                  </p>
                  <button
                    onClick={() =>
                      (window.location.href = "/admin/whatsapp-setup")
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Settings size={16} />
                    View Setup Guide
                  </button>
                </>
              ) : (
                <>
                  <p>No conversations yet</p>
                  <p className="text-sm mt-2">
                    Conversations will appear here when customers message you
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">
                          {conv.customer_name || "Unknown Customer"}
                        </h3>
                        <p className="text-xs text-gray-500">{conv.phone}</p>
                        {conv.branch_name && (
                          <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            {conv.branch_name}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 truncate mb-2">
                    {conv.last_message}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatTime(conv.last_message_at)}
                    </span>
                    {conv.branch_name && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {conv.branch_name}
                      </span>
                    )}
                  </div>

                  {!conv.session_active && (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Session expired (24h)
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages Panel */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <User size={18} />
                      {selectedConversation.customer_name || "Unknown Customer"}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Phone size={14} />
                        {selectedConversation.phone}
                      </span>
                      {selectedConversation.branch_name && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {selectedConversation.branch_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedConversation.session_active ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle size={16} />
                      Active Session
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <AlertCircle size={16} />
                      Session Expired
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No messages yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.direction === "outbound"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            msg.direction === "outbound"
                              ? "bg-blue-600 text-white"
                              : "bg-white border border-gray-200"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.message_text}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.direction === "outbound"
                                ? "text-blue-100"
                                : "text-gray-500"
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString()}
                            {msg.status === "failed" && (
                              <span className="ml-2 text-red-400">
                                ✗ Failed
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Replies */}
              <div className="px-4 py-2 border-t border-gray-200 bg-white">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() =>
                      handleQuickReply("Your order is being prepared.")
                    }
                    className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    Order preparing
                  </button>
                  <button
                    onClick={() =>
                      handleQuickReply("Your order is out for delivery.")
                    }
                    className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    Out for delivery
                  </button>
                  <button
                    onClick={() =>
                      handleQuickReply(
                        "We are checking this for you. Will get back to you shortly."
                      )
                    }
                    className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    Checking...
                  </button>
                </div>
              </div>

              {/* Reply Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                {error && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                    {error}
                  </div>
                )}

                {!selectedConversation.session_active && (
                  <div className="mb-2 p-2 bg-amber-50 border border-amber-200 text-amber-700 rounded text-sm">
                    ⚠️ 24-hour session expired. Customer must message first to
                    reactivate.
                  </div>
                )}

                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder={
                      selectedConversation.session_active
                        ? "Type your message..."
                        : "Cannot send - session expired"
                    }
                    disabled={!selectedConversation.session_active || sending}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    rows="2"
                  />
                  <button
                    onClick={sendReply}
                    disabled={
                      !replyText.trim() ||
                      !selectedConversation.session_active ||
                      sending
                    }
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send size={18} />
                    )}
                    Send
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Footer "— Néo Beirut" will be added automatically
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare
                  size={64}
                  className="mx-auto mb-4 text-gray-300"
                />
                <p className="text-lg">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}