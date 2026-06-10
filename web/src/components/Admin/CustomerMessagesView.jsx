"use client";

import { useState, useEffect } from "react";
import {
  MessageCircle,
  AlertTriangle,
  Star,
  Phone,
  Package,
} from "lucide-react";

export default function CustomerMessagesView() {
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("messages"); // messages | feedback
  const [filterDirection, setFilterDirection] = useState("all"); // all | inbound | outbound
  const [filterRating, setFilterRating] = useState("all"); // all | low | high

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent WhatsApp messages
      const messagesRes = await fetch("/api/admin/customer-messages");
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.messages || []);
      }

      // Fetch feedback
      const feedbackRes = await fetch("/api/admin/customer-feedback");
      if (feedbackRes.ok) {
        const data = await feedbackRes.json();
        setFeedback(data.feedback || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filterDirection === "all") return true;
    return msg.direction === filterDirection;
  });

  const filteredFeedback = feedback.filter((fb) => {
    if (filterRating === "all") return true;
    if (filterRating === "low") return fb.rating <= 3;
    if (filterRating === "high") return fb.rating >= 4;
    return true;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={16}
        className={
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading customer messages...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Customer Messages & Feedback
        </h2>
        <button
          onClick={fetchData}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("messages")}
            className={`px-4 py-2 border-b-2 ${
              activeTab === "messages"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600"
            }`}
          >
            <MessageCircle size={18} className="inline mr-2" />
            Messages ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2 border-b-2 ${
              activeTab === "feedback"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600"
            }`}
          >
            <Star size={18} className="inline mr-2" />
            Feedback ({feedback.length})
          </button>
        </div>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Directions</option>
              <option value="inbound">Inbound (from customer)</option>
              <option value="outbound">Outbound (to customer)</option>
            </select>
          </div>

          {/* Messages List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No messages found
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 ${
                      msg.direction === "inbound" ? "bg-blue-50" : "bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            msg.direction === "inbound"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {msg.direction === "inbound" ? (
                            <MessageCircle size={20} />
                          ) : (
                            <Phone size={20} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {msg.user_name || "Unknown Customer"}
                          </div>
                          <div className="text-sm text-gray-600">
                            {msg.phone}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(msg.created_at)}
                      </div>
                    </div>

                    <div className="ml-14">
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {msg.message_text}
                      </p>

                      {msg.order_id && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                          <Package size={14} />
                          Order #{msg.order_id}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-gray-100 rounded">
                          {msg.message_type}
                        </span>
                        {msg.template_name && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            Template: {msg.template_name}
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded ${
                            msg.status === "sent" || msg.status === "received"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {msg.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === "feedback" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Ratings</option>
              <option value="low">Low (1-3 stars)</option>
              <option value="high">High (4-5 stars)</option>
            </select>
          </div>

          {/* Feedback List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {filteredFeedback.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No feedback found
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className={`p-4 ${
                      fb.rating <= 3
                        ? "bg-red-50 border-l-4 border-red-500"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {fb.rating <= 3 && (
                          <AlertTriangle size={20} className="text-red-500" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {fb.user_name || "Unknown Customer"}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {renderStars(fb.rating)}
                            <span className="text-sm text-gray-600 ml-2">
                              {fb.rating}/5
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(fb.created_at)}
                      </div>
                    </div>

                    {fb.feedback_text && (
                      <p className="text-gray-800 whitespace-pre-wrap mb-3">
                        {fb.feedback_text}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        Order #{fb.order_id}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {fb.source}
                      </span>
                      {fb.admin_notified && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                          Manager Notified
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
