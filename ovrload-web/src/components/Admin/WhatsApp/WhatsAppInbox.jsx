"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  Send,
  Paperclip,
  Smile,
  FileText,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Tag,
  MapPin,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  X,
  Plus,
  Shield,
  ShoppingBag,
  Award,
  DollarSign,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import SendTemplateModal from "./SendTemplateModal";

export default function WhatsAppInbox({ adminToken, adminUser, initialPhone = null }) {
  const getEffectiveToken = () => {
    return (
      adminToken ||
      (typeof window !== "undefined" ? localStorage.getItem("admin_token") : "") ||
      ""
    );
  };

  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState(null);

  // Attachment state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const fileInputRef = useRef(null);

  // Modals & Staff
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [contactNotes, setContactNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);

  // Realtime & scroll
  const messagesEndRef = useRef(null);
  const sseRef = useRef(null);

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations and staff list on mount
  useEffect(() => {
    fetchConversations();
    fetchStaffList();

    // Setup Server-Sent Events (SSE) for Realtime updates
    setupRealtimeSSE();

    // Backup polling every 8 seconds
    const interval = setInterval(() => {
      fetchConversations(false);
      if (selectedConversation?.id) {
        fetchMessages(selectedConversation.id, false);
      }
    }, 8000);

    return () => {
      clearInterval(interval);
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  // Filter or search change
  useEffect(() => {
    fetchConversations(false);
  }, [filter, searchQuery]);

  // Handle selected conversation change
  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id, true);
      fetchConversationDetails(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Handle initialPhone prop (e.g. opened from Contacts or Orders)
  useEffect(() => {
    if (initialPhone && conversations.length > 0) {
      const match = conversations.find(
        (c) => c.phone === initialPhone || c.contact_phone === initialPhone
      );
      if (match) {
        setSelectedConversation(match);
      }
    }
  }, [initialPhone, conversations]);

  // ==========================================
  // Realtime SSE Setup
  // ==========================================
  const setupRealtimeSSE = () => {
    try {
      const evtSource = new EventSource("/api/whatsapp/realtime");
      sseRef.current = evtSource;

      evtSource.addEventListener("whatsapp.message.received", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { message, conversation } = payload.data || {};

          // Update message history if viewing this conversation
          setSelectedConversation((current) => {
            if (current && conversation && current.id === conversation.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === message.id || (m.infobip_message_id && m.infobip_message_id === message.infobip_message_id))) {
                  return prev;
                }
                return [...prev, message];
              });
              // Auto mark read if open
              markAsRead(conversation.id);
            }
            return current;
          });

          // Refresh conversation list to show new message & badge
          fetchConversations(false);
        } catch (err) {
          console.error("[SSE parse error]", err);
        }
      });

      evtSource.addEventListener("whatsapp.message.sent", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { message, conversationId } = payload.data || {};

          setSelectedConversation((current) => {
            if (current && current.id === conversationId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === message.id || (m.infobip_message_id && m.infobip_message_id === message.infobip_message_id))) {
                  return prev;
                }
                return [...prev, message];
              });
            }
            return current;
          });
          fetchConversations(false);
        } catch (err) {}
      });

      evtSource.addEventListener("whatsapp.message.updated", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { messageId, status } = payload.data || {};
          setMessages((prev) =>
            prev.map((m) => (m.infobip_message_id === messageId ? { ...m, status } : m))
          );
        } catch (err) {}
      });

      evtSource.addEventListener("whatsapp.conversation.updated", (e) => {
        fetchConversations(false);
      });

      evtSource.onerror = () => {
        // SSE disconnected, fallback polling continues seamlessly
      };
    } catch (e) {
      console.warn("SSE not supported or failed to initialize", e);
    }
  };

  // ==========================================
  // API Fetchers
  // ==========================================
  const fetchConversations = async (showSpinner = true) => {
    if (showSpinner) setLoadingConversations(true);
    try {
      const query = new URLSearchParams();
      if (filter && filter !== "all") query.set("filter", filter);
      if (searchQuery.trim()) query.set("search", searchQuery.trim());

      const res = await fetch("/api/whatsapp/conversations?" + query.toString(), {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setConversations(data.conversations || []);

        // Auto select first conversation if none selected yet
        setSelectedConversation((curr) => {
          if (!curr && data.conversations.length > 0) {
            return data.conversations[0];
          }
          // Update current selected conversation object with fresh data
          if (curr) {
            const fresh = data.conversations.find((c) => c.id === curr.id);
            return fresh || curr;
          }
          return null;
        });
      }
    } catch (err) {
      console.error("Failed fetching conversations:", err);
    } finally {
      if (showSpinner) setLoadingConversations(false);
    }
  };

  const fetchMessages = async (convId, showSpinner = true) => {
    if (!convId) return;
    if (showSpinner) setLoadingMessages(true);
    try {
      const res = await fetch("/api/whatsapp/conversations/" + convId + "/messages?limit=50", {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed fetching messages:", err);
    } finally {
      if (showSpinner) setLoadingMessages(false);
    }
  };

  const fetchConversationDetails = async (convId) => {
    try {
      const res = await fetch("/api/whatsapp/conversations/" + convId, {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.ok) {
        setConversationDetails(data);
        setContactNotes(data.conversation?.contact_notes || "");
      }
    } catch (err) {
      console.error("Failed fetching conversation details:", err);
    }
  };

  const fetchStaffList = async () => {
    try {
      const res = await fetch("/api/admin-users", {
        headers: { "x-admin-token": getEffectiveToken() },
      });
      const data = await res.json();
      if (data.admins) {
        setStaffList(data.admins);
      }
    } catch (e) {}
  };

  const markAsRead = async (convId) => {
    try {
      await fetch("/api/whatsapp/conversations/" + convId + "/read", {
        method: "POST",
        headers: { "x-admin-token": getEffectiveToken() },
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
    } catch (e) {}
  };

  // ==========================================
  // Messaging Actions
  // ==========================================
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!replyText.trim() && !pendingAttachment) || !selectedConversation || sending) return;

    // Check service window
    if (!selectedConversation.is_window_active) {
      setComposerError("Customer service window has expired. You must send an approved template.");
      return;
    }

    setSending(true);
    setComposerError(null);

    const textToSend = replyText.trim();
    const attachment = pendingAttachment;

    // Optimistic UI message
    const tempId = "temp-" + Date.now();
    const optimisticMsg = {
      id: tempId,
      conversation_id: selectedConversation.id,
      direction: "outgoing",
      message_type: attachment ? attachment.type : "text",
      text_content: textToSend || (attachment ? attachment.filename : ""),
      media_url: attachment?.url || null,
      media_filename: attachment?.filename || null,
      status: "sending",
      created_at: new Date().toISOString(),
      sent_by_user_name: adminUser?.name || "You",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyText("");
    setPendingAttachment(null);

    try {
      const res = await fetch("/api/whatsapp/conversations/" + selectedConversation.id + "/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          text: textToSend,
          messageType: attachment ? attachment.type : "text",
          mediaUrl: attachment?.url,
          filename: attachment?.filename,
          caption: textToSend,
        }),
      });

      const data = await res.json();
      if (data.ok && data.message) {
        // Reconcile optimistic message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message, sent_by_user_name: adminUser?.name || "You" } : m))
        );
        fetchConversations(false);
      } else {
        // Mark optimistic message as failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed", error_message: data.error } : m
          )
        );
        setComposerError(data.error || "Failed to send message");
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed", error_message: "Network error" } : m
        )
      );
      setComposerError("Network error while sending message");
    } finally {
      setSending(false);
    }
  };

  // Handle File Attachment Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setComposerError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/whatsapp/media/upload", {
        method: "POST",
        headers: { "x-admin-token": getEffectiveToken() },
        body: formData,
      });

      const data = await res.json();
      if (data.ok && data.mediaUrl) {
        let type = "document";
        if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("video/")) type = "video";
        else if (file.type.startsWith("audio/")) type = "audio";

        setPendingAttachment({
          url: data.mediaUrl,
          filename: data.filename || file.name,
          type,
          mimeType: data.mimeType || file.type,
        });
      } else {
        setComposerError(data.error || "Failed to upload file");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setComposerError("Failed to upload attachment");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Assignment Handlers
  const handleAssign = async (userId) => {
    if (!selectedConversation) return;
    try {
      const res = await fetch("/api/whatsapp/conversations/" + selectedConversation.id + "/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({ assigned_user_id: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedConversation((curr) => ({
          ...curr,
          assigned_user_id: userId,
          assigned_user_name: staffList.find((s) => s.id === userId)?.name || null,
        }));
        fetchConversations(false);
      }
    } catch (e) {}
  };

  // Status Toggle (Open/Closed)
  const handleToggleStatus = async () => {
    if (!selectedConversation) return;
    const newStatus = selectedConversation.status === "closed" ? "open" : "closed";
    try {
      const res = await fetch("/api/whatsapp/conversations/" + selectedConversation.id + "/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedConversation((curr) => ({ ...curr, status: newStatus }));
        fetchConversations(false);
      }
    } catch (e) {}
  };

  // Save Contact Notes
  const handleSaveNotes = async () => {
    if (!selectedConversation?.contact_id) return;
    setSavingNotes(true);
    try {
      await fetch("/api/whatsapp/contacts/" + selectedConversation.contact_id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({ notes: contactNotes }),
      });
      fetchConversationDetails(selectedConversation.id);
    } catch (e) {
    } finally {
      setSavingNotes(false);
    }
  };

  // Add Tag
  const handleAddTag = async () => {
    if (!newTagInput.trim() || !selectedConversation?.contact_id) return;
    const currentTags = conversationDetails?.conversation?.contact_tags || [];
    if (currentTags.includes(newTagInput.trim())) {
      setNewTagInput("");
      setShowAddTag(false);
      return;
    }
    const updatedTags = [...currentTags, newTagInput.trim()];

    try {
      await fetch("/api/whatsapp/contacts/" + selectedConversation.contact_id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({ tags: updatedTags }),
      });
      setNewTagInput("");
      setShowAddTag(false);
      fetchConversationDetails(selectedConversation.id);
    } catch (e) {}
  };

  // Toggle Opt-in
  const handleToggleOptIn = async () => {
    if (!selectedConversation?.contact_id) return;
    const currentOptIn = Boolean(conversationDetails?.conversation?.whatsapp_opt_in);
    try {
      await fetch("/api/whatsapp/contacts/" + selectedConversation.contact_id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getEffectiveToken(),
        },
        body: JSON.stringify({
          whatsapp_opt_in: !currentOptIn,
          whatsapp_opt_in_source: "staff_toggle",
        }),
      });
      fetchConversationDetails(selectedConversation.id);
      fetchConversations(false);
    } catch (e) {}
  };

  // Format relative timestamp
  const formatTime = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return diffMins + "m ago";
    if (diffMins < 1440) return Math.floor(diffMins / 60) + "h ago";
    if (diffMins < 2880) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Delivery status indicator component
  const renderDeliveryStatus = (status) => {
    switch (status) {
      case "sending":
        return <Clock className="w-3.5 h-3.5 text-gray-400" title="Sending..." />;
      case "sent":
        return <Check className="w-3.5 h-3.5 text-gray-400" title="Sent to Infobip" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-gray-400" title="Delivered to handset" />;
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" title="Read by customer" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" title="Delivery failed" />;
      default:
        return <Check className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-145px)] bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* ========================================================= */}
      {/* LEFT PANEL: Filters, Search, Conversation List */}
      {/* ========================================================= */}
      <div className="w-80 sm:w-96 border-r border-slate-800/80 flex flex-col bg-slate-900/90 shrink-0">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              WhatsApp Inbox
            </h2>
            <button
              onClick={() => fetchConversations(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Refresh inbox"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or text..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {[
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
              { id: "open", label: "Open" },
              { id: "closed", label: "Closed" },
              { id: "assigned_to_me", label: "My Chats" },
              { id: "unassigned", label: "Unassigned" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={"px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition " +
                  (filter === f.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {loadingConversations ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2" />
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-500 text-xs">
              <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-400">No conversations found</p>
              <p className="mt-1 text-slate-500">Incoming messages from customers will appear here.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              const hasUnread = conv.unread_count > 0;
              const name = conv.contact_name || conv.customer_name || conv.phone;
              const initials = (name.slice(0, 2) || "WA").toUpperCase();

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={"p-3.5 cursor-pointer transition flex items-start gap-3 relative " +
                    (isSelected
                      ? "bg-emerald-950/40 border-l-4 border-emerald-500"
                      : "hover:bg-slate-800/50")}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold text-xs shadow-md">
                      {initials}
                    </div>
                    {/* Window status indicator dot */}
                    <span
                      className={"absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 " +
                        (conv.is_window_active ? "bg-emerald-500" : "bg-amber-500")}
                      title={conv.is_window_active ? "24h Window Active" : "24h Window Expired"}
                    />
                  </div>

                  {/* Conversation snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={"text-xs truncate font-semibold " + (hasUnread ? "text-white font-bold" : "text-slate-200")}>
                        {name}
                      </h4>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {formatTime(conv.last_message_at || conv.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className={"text-xs truncate " + (hasUnread ? "text-emerald-400 font-medium" : "text-slate-400")}>
                        {conv.last_message_preview || conv.last_message || "No messages yet"}
                      </p>
                      {hasUnread && (
                        <span className="shrink-0 bg-emerald-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Metadata chips */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {conv.assigned_user_name && (
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {conv.assigned_user_name}
                        </span>
                      )}
                      {conv.status === "closed" && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CENTER PANEL: Active Conversation, Chat History, Composer */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col bg-slate-950 min-w-0 border-r border-slate-800/80">
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-3.5 px-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                  {((selectedConversation.contact_name || selectedConversation.customer_name || selectedConversation.phone).slice(0, 2) || "WA").toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {selectedConversation.contact_name || selectedConversation.customer_name || selectedConversation.phone}
                    {selectedConversation.customer_id && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded-full font-medium">
                        Linked Client
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{selectedConversation.phone}</span>
                    {selectedConversation.is_window_active ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        ● 24h Free Window Active
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        ● Window Expired (Template Required)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Header Action Controls */}
              <div className="flex items-center gap-2 text-xs">
                {/* Assignment Dropdown */}
                <select
                  value={selectedConversation.assigned_user_id || ""}
                  onChange={(e) => handleAssign(e.target.value ? Number(e.target.value) : null)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Unassigned</option>
                  {adminUser?.id && (
                    <option value={adminUser.id}>Assign to me ({adminUser.name})</option>
                  )}
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {/* Status Toggle Button */}
                <button
                  onClick={handleToggleStatus}
                  className={"px-3 py-1 rounded-lg font-medium transition text-xs border " +
                    (selectedConversation.status === "closed"
                      ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                      : "bg-emerald-950/70 text-emerald-400 border-emerald-800 hover:bg-emerald-900/60")}
                >
                  {selectedConversation.status === "closed" ? "Re-open" : "Close Chat"}
                </button>
              </div>
            </div>

            {/* 24-Hour Customer Service Window Alert Banner */}
            {!selectedConversation.is_window_active && (
              <div className="bg-amber-950/50 border-b border-amber-800/80 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Customer service window expired.</strong> Meta policy requires an approved template to reopen this conversation.
                  </span>
                </div>
                <button
                  onClick={() => setTemplateModalOpen(true)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Send Template
                </button>
              </div>
            )}

            {/* Message History List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/60">
              {loadingMessages ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2" />
                  Loading message history...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-50" />
                  <p>No messages in this conversation yet.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOut = msg.direction === "outgoing";
                  const isTemplate = msg.message_type === "template";
                  const isImage = msg.message_type === "image";
                  const isDocument = msg.message_type === "document" || msg.message_type === "pdf";
                  const isVideo = msg.message_type === "video";
                  const isAudio = msg.message_type === "audio" || msg.message_type === "voice";
                  const isLocation = msg.message_type === "location";

                  return (
                    <div
                      key={msg.id}
                      className={"flex flex-col " + (isOut ? "items-end" : "items-start")}
                    >
                      <div
                        className={"max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm " +
                          (isOut
                            ? "bg-emerald-700 text-white rounded-tr-none"
                            : "bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/60")}
                      >
                        {/* Outgoing Staff author name */}
                        {isOut && msg.sent_by_user_name && (
                          <div className="text-[10px] text-emerald-200 font-semibold mb-1">
                            {msg.sent_by_user_name}
                          </div>
                        )}

                        {/* Template Badge */}
                        {isTemplate && (
                          <div className="inline-flex items-center gap-1 text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-medium mb-1.5">
                            <Sparkles className="w-3 h-3" />
                            Approved Template: {msg.template_name}
                          </div>
                        )}

                        {/* Image media rendering */}
                        {isImage && msg.media_url && (
                          <div className="mb-2 overflow-hidden rounded-xl bg-black/20">
                            <img
                              src={msg.media_url}
                              alt="Attachment"
                              className="max-h-64 rounded-xl object-contain hover:scale-105 transition cursor-pointer"
                              onClick={() => window.open(msg.media_url, "_blank")}
                            />
                          </div>
                        )}

                        {/* Document media rendering */}
                        {isDocument && msg.media_url && (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 p-2 bg-black/20 rounded-xl mb-2 hover:bg-black/30 transition text-xs font-medium"
                          >
                            <FileText className="w-6 h-6 text-emerald-300" />
                            <div className="truncate flex-1">
                              <div className="font-semibold truncate">
                                {msg.media_filename || "Attached Document"}
                              </div>
                              <span className="text-[10px] opacity-80">Click to view/download</span>
                            </div>
                            <ExternalLink className="w-4 h-4 opacity-70" />
                          </a>
                        )}

                        {/* Video media rendering */}
                        {isVideo && msg.media_url && (
                          <div className="mb-2 rounded-xl overflow-hidden bg-black/30">
                            <video src={msg.media_url} controls className="max-h-64 w-full rounded-xl" />
                          </div>
                        )}

                        {/* Audio / Voice note rendering */}
                        {isAudio && msg.media_url && (
                          <div className="mb-2">
                            <audio src={msg.media_url} controls className="w-full h-8" />
                          </div>
                        )}

                        {/* Location rendering */}
                        {isLocation && msg.media_url && (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2.5 bg-black/20 rounded-xl mb-1.5 text-xs text-emerald-200 hover:text-white"
                          >
                            <MapPin className="w-5 h-5 text-emerald-400" />
                            <span>{msg.text_content || "View Location on Google Maps"}</span>
                          </a>
                        )}

                        {/* Text Content */}
                        {(!isLocation || !msg.media_url) && (
                          <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                            {msg.text_content}
                          </p>
                        )}

                        {/* Footer info: time & delivery ticks */}
                        <div
                          className={"flex items-center justify-end gap-1.5 text-[10px] mt-1 " +
                            (isOut ? "text-emerald-200" : "text-slate-400")}
                        >
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOut && renderDeliveryStatus(msg.status)}
                        </div>

                        {/* Error info if failed */}
                        {msg.status === "failed" && msg.error_message && (
                          <p className="text-[10px] text-red-300 mt-1 italic">
                            Error: {msg.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reply Snippets */}
            <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/60 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider shrink-0">
                Quick:
              </span>
              {[
                "Your order is currently being prepared! 🌯",
                "Your order is out for delivery with our driver 🛵",
                "Thank you for contacting OVRLOAD! How can we help you today?",
                "We are checking this for you right away. One moment please!",
              ].map((qr, idx) => (
                <button
                  key={idx}
                  onClick={() => setReplyText(qr)}
                  disabled={!selectedConversation.is_window_active}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full whitespace-nowrap text-[11px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {qr.length > 28 ? qr.slice(0, 28) + "..." : qr}
                </button>
              ))}
            </div>

            {/* Pending Attachment Chip */}
            {pendingAttachment && (
              <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-emerald-400">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-4 h-4" />
                  <span className="truncate">Attached: {pendingAttachment.filename}</span>
                </div>
                <button
                  onClick={() => setPendingAttachment(null)}
                  className="p-1 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sticky Composer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
              {composerError && (
                <div className="mb-2 p-2 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs flex items-center justify-between">
                  <span>{composerError}</span>
                  <button onClick={() => setComposerError(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                {/* Attachment Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf,video/*,audio/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || !selectedConversation.is_window_active}
                  title="Attach Image or Document"
                  className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-800 transition disabled:opacity-40"
                >
                  {uploadingFile ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500" />
                  ) : (
                    <Paperclip size={18} />
                  )}
                </button>

                {/* Send Template Button */}
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  title="Send Approved Template Message"
                  className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-800 transition"
                >
                  <FileText size={18} />
                </button>

                {/* Quick Emoji Buttons */}
                <div className="hidden sm:flex items-center gap-1 pb-1">
                  {["😊", "👍", "🌯", "🙏"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setReplyText((prev) => prev + emoji)}
                      className="hover:scale-125 transition text-sm p-1 rounded"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Message Textarea */}
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    selectedConversation.is_window_active
                      ? "Type a WhatsApp message (Enter to send, Shift+Enter for new line)..."
                      : "24h window expired. Use 'Send Template' button above to message."
                  }
                  disabled={!selectedConversation.is_window_active || sending}
                  rows={2}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none disabled:bg-slate-900/60 disabled:cursor-not-allowed"
                />

                {/* Submit Send Button */}
                <button
                  type="submit"
                  disabled={
                    (!replyText.trim() && !pendingAttachment) ||
                    !selectedConversation.is_window_active ||
                    sending
                  }
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition shrink-0"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 text-center">
            <MessageSquare className="w-16 h-16 text-slate-800 mb-3" />
            <h3 className="text-base font-bold text-slate-400">No Conversation Selected</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Select a client conversation from the left panel to read and send WhatsApp messages.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Contact Details, CRM Order Data, Notes */}
      {/* ========================================================= */}
      {selectedConversation && (
        <div className="w-72 sm:w-80 bg-slate-900/80 p-4 overflow-y-auto space-y-4 shrink-0 text-xs">
          {/* Contact Card Header */}
          <div className="text-center pb-3 border-b border-slate-800">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-base mx-auto mb-2 shadow-lg">
              {((selectedConversation.contact_name || selectedConversation.customer_name || selectedConversation.phone).slice(0, 2) || "WA").toUpperCase()}
            </div>
            <h3 className="font-bold text-sm text-white truncate">
              {selectedConversation.contact_name || selectedConversation.customer_name || "Unknown Customer"}
            </h3>
            <p className="text-slate-400 mt-0.5">{selectedConversation.phone}</p>

            {/* Marketing Opt-In Badge */}
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span
                className={"px-2.5 py-0.5 rounded-full text-[10px] font-semibold border " +
                  (conversationDetails?.conversation?.whatsapp_opt_in
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : "bg-slate-800 text-slate-400 border-slate-700")}
              >
                {conversationDetails?.conversation?.whatsapp_opt_in ? "✓ Marketing Opted In" : "✗ No Marketing Consent"}
              </span>
              <button
                onClick={handleToggleOptIn}
                className="text-[10px] text-slate-400 hover:text-white underline"
              >
                Toggle
              </button>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Contact Information
            </h4>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phone (E.164)</span>
                <span className="font-mono text-emerald-400">{selectedConversation.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email</span>
                <span className="truncate max-w-[150px]">{conversationDetails?.conversation?.contact_email || "None"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assigned Staff</span>
                <span className="text-white font-medium">{selectedConversation.assigned_user_name || "Unassigned"}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Tags
              </h4>
              <button
                onClick={() => setShowAddTag(!showAddTag)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
              >
                <Plus size={12} /> Add Tag
              </button>
            </div>

            {showAddTag && (
              <div className="flex gap-1 mb-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Tag name..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAddTag}
                  className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                >
                  Add
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(conversationDetails?.conversation?.contact_tags || []).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[10px] font-medium"
                >
                  #{tag}
                </span>
              ))}
              {(!conversationDetails?.conversation?.contact_tags ||
                conversationDetails.conversation.contact_tags.length === 0) && (
                <span className="text-slate-500 text-[11px] italic">No tags attached</span>
              )}
            </div>
          </div>

          {/* Internal Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Internal Notes
              </h4>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold"
              >
                {savingNotes ? "Saving..." : "Save"}
              </button>
            </div>
            <textarea
              value={contactNotes}
              onChange={(e) => setContactNotes(e.target.value)}
              placeholder="Staff notes about this client..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Linked CRM Orders Data */}
          {selectedConversation.customer_id && (
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShoppingBag size={12} />
                Client Purchase History
              </h4>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Tier</div>
                  <div className="font-bold text-amber-400">
                    {conversationDetails?.conversation?.customer_tier || "Standard"}
                  </div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Total Spent</div>
                  <div className="font-bold text-emerald-400">
                    ${parseFloat(conversationDetails?.conversation?.customer_total_spent || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              {conversationDetails?.recentOrders && conversationDetails.recentOrders.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold">Recent Orders:</span>
                  {conversationDetails.recentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-2 bg-slate-950/70 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-white">Order #{ord.id}</span>
                        <div className="text-[10px] text-slate-500">
                          {new Date(ord.created_at).toLocaleDateString()} • {ord.status}
                        </div>
                      </div>
                      <span className="font-bold text-emerald-400">${parseFloat(ord.total_amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Send Template Modal */}
      {templateModalOpen && selectedConversation && (
        <SendTemplateModal
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          conversationId={selectedConversation.id}
          recipientName={selectedConversation.contact_name || selectedConversation.customer_name || selectedConversation.phone}
          recipientPhone={selectedConversation.phone}
          adminToken={adminToken}
          onSuccess={() => {
            fetchMessages(selectedConversation.id, false);
            fetchConversations(false);
          }}
        />
      )}
    </div>
  );
}
