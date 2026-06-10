import { useCallback, useEffect, useState } from "react";
import { Send, Bell, Calendar } from "lucide-react";

export default function NotificationsView() {
  const [branches, setBranches] = useState([]);
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [notificationType, setNotificationType] = useState("custom"); // 'custom' or 'event'
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedBranches, setSelectedBranches] = useState(["all"]);
  const [targetPage, setTargetPage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventMessage, setEventMessage] = useState("");

  const getAdminHeaders = useCallback(() => {
    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");
      if (!adminToken || !adminId) return {};
      return {
        "x-admin-token": adminToken,
        "x-admin-id": adminId,
      };
    } catch (e) {
      return {};
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      const data = await response.json();
      setBranches(data.branches || []);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events?status=published&limit=100");
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/admin/notifications/history?limit=20",
        {
          headers: getAdminHeaders(),
        },
      );

      if (response.status === 401 || response.status === 403) {
        setHistory([]);
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setHistory(data.notifications || []);
    } catch (err) {
      console.error("Error fetching notification history:", err);
    }
  }, [getAdminHeaders]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchBranches(), fetchEvents(), fetchHistory()]).finally(
      () => {
        setLoading(false);
      },
    );
  }, [fetchBranches, fetchEvents, fetchHistory]);

  const handleBranchChange = (branchId) => {
    if (branchId === "all") {
      setSelectedBranches(["all"]);
    } else {
      const filtered = selectedBranches.filter((id) => id !== "all");
      if (filtered.includes(branchId)) {
        const newSelection = filtered.filter((id) => id !== branchId);
        setSelectedBranches(newSelection.length === 0 ? ["all"] : newSelection);
      } else {
        setSelectedBranches([...filtered, branchId]);
      }
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();

    console.log(
      "\n╔════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║  FRONTEND: Starting Push Notification Send                ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝",
    );
    console.log("[FRONTEND] Timestamp:", new Date().toISOString());
    console.log("[FRONTEND] Form state:", {
      notificationType,
      title,
      message,
      selectedBranches,
      targetPage,
      selectedEvent,
      eventMessage,
    });

    setError(null);
    setSuccess(null);

    let finalTitle = title;
    let finalMessage = message;
    let finalEventId = null;

    if (notificationType === "event") {
      console.log("[FRONTEND] Event notification mode");
      if (!selectedEvent) {
        console.error("[FRONTEND] Validation failed: No event selected");
        setError("Please select an event");
        return;
      }

      const event = events.find((ev) => ev.id === selectedEvent);
      if (!event) {
        console.error("[FRONTEND] Validation failed: Event not found");
        setError("Event not found");
        return;
      }

      console.log("[FRONTEND] Selected event:", {
        id: event.id,
        name: event.name,
        description: event.description?.substring(0, 50) + "...",
      });

      finalTitle = event.name;
      finalMessage =
        eventMessage || event.description || "Check out this event!";
      finalEventId = event.id;
    } else {
      console.log("[FRONTEND] Custom notification mode");
      if (!title.trim() || !message.trim()) {
        console.error("[FRONTEND] Validation failed: Missing title or message");
        setError("Title and message are required");
        return;
      }
    }

    console.log("[FRONTEND] Final notification details:", {
      finalTitle,
      finalMessage: finalMessage.substring(0, 100),
      finalEventId,
    });

    setSending(true);

    console.log("[NOTIFICATIONS] ========================================");
    console.log("[NOTIFICATIONS] Starting notification send...");
    console.log("[NOTIFICATIONS] Title:", finalTitle);
    console.log("[NOTIFICATIONS] Message:", finalMessage);
    console.log("[NOTIFICATIONS] Branches:", selectedBranches);
    console.log("[NOTIFICATIONS] Target Page:", targetPage);
    console.log("[NOTIFICATIONS] Event ID:", finalEventId);

    try {
      const adminHeaders = getAdminHeaders();
      console.log(
        "[NOTIFICATIONS] Admin headers present:",
        Object.keys(adminHeaders).length > 0,
      );

      const requestBody = {
        title: finalTitle,
        message: finalMessage,
        branchIds: selectedBranches,
        targetPage: targetPage || null,
        eventId: finalEventId,
      };

      console.log(
        "[NOTIFICATIONS] Request body:",
        JSON.stringify(requestBody, null, 2),
      );

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...adminHeaders,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[NOTIFICATIONS] Response status:", response.status);
      console.log("[NOTIFICATIONS] Response OK:", response.ok);

      if (response.status === 401 || response.status === 403) {
        throw new Error("Admin session expired. Please login again.");
      }

      // Get response text first for better error debugging
      const responseText = await response.text();
      console.log("[NOTIFICATIONS] Response text:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[NOTIFICATIONS] Failed to parse response:", parseError);
        throw new Error(
          `Invalid response from server: ${responseText.substring(0, 200)}`,
        );
      }

      console.log("[NOTIFICATIONS] Parsed response:", data);

      if (!response.ok) {
        console.error("[NOTIFICATIONS] Error response:", data);
        throw new Error(data?.error || `Failed (status ${response.status})`);
      }

      console.log("[NOTIFICATIONS] Success!");
      console.log("[NOTIFICATIONS] Stats:", data.stats);
      console.log("[NOTIFICATIONS] Errors:", data.errors);

      // Build success message with detailed stats
      let successMsg = `✅ Notification sent successfully! Reached ${data.stats?.successfulSends || 0} of ${data.stats?.totalTokens || 0} devices.`;

      // Add more detailed breakdown
      if (data.stats) {
        successMsg += `\n\n📊 Breakdown:`;
        successMsg += `\n• Total users targeted: ${data.stats.totalUsers || 0}`;
        successMsg += `\n• Total push tokens found: ${data.stats.totalTokens || 0}`;
        successMsg += `\n• Valid Expo tokens: ${data.stats.validTokens || 0}`;
        successMsg += `\n• Successfully sent: ${data.stats.successfulSends || 0}`;
        if (data.stats.failedSends > 0) {
          successMsg += `\n• Failed: ${data.stats.failedSends}`;
        }
      }

      // Add error details if there were failures
      if (data.errors && data.errors.length > 0) {
        const errorSummary = data.errors
          .slice(0, 3) // Show first 3 errors
          .map((err) => `• ${err.error}`)
          .join("\n");

        successMsg += `\n\n⚠️ ${data.errors.length} notification(s) failed:\n${errorSummary}`;

        if (data.errors.length > 3) {
          successMsg += `\n• ...and ${data.errors.length - 3} more`;
        }
      }

      console.log("[NOTIFICATIONS] ========================================");

      setSuccess(successMsg);

      // Reset form
      setTitle("");
      setMessage("");
      setEventMessage("");
      setSelectedBranches(["all"]);
      setTargetPage("");
      setSelectedEvent(null);

      // Refresh history
      fetchHistory();
    } catch (err) {
      console.error("[NOTIFICATIONS] ❌ ERROR:", err);
      console.error("[NOTIFICATIONS] Error name:", err.name);
      console.error("[NOTIFICATIONS] Error message:", err.message);
      console.error("[NOTIFICATIONS] Error stack:", err.stack);
      console.log("[NOTIFICATIONS] ========================================");

      setError(
        `❌ ${err?.message || "Failed to send notification"}\n\n🔍 Check the browser console (F12) for detailed error logs.`,
      );
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatBranches = (branchIds) => {
    if (!branchIds || branchIds.length === 0 || branchIds.includes("all")) {
      return "All Branches";
    }

    const branchNames = branchIds
      .map((id) => {
        const branch = branches.find((b) => b.id === id);
        return branch?.name || `Branch ${id}`;
      })
      .join(", ");

    return branchNames;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Push Notifications
          </h2>
          <p className="text-gray-600 mt-1">
            Send push notifications to users by branch or event
          </p>
          <div className="mt-2 space-y-1">
            <a
              href="/admin/push-diagnostics"
              className="text-sm text-blue-600 hover:text-blue-700 underline block"
            >
              🔧 Troubleshoot push notifications (check if a user can receive
              notifications)
            </a>
            <a
              href="/admin/token-cleanup"
              className="text-sm text-orange-600 hover:text-orange-700 underline block"
            >
              🗑️ Clean up old development tokens (if notifications are failing)
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg whitespace-pre-line">
          {success}
        </div>
      )}

      {/* Send Notification Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Send size={20} />
          Send New Notification
        </h3>

        <form onSubmit={handleSendNotification} className="space-y-4">
          {/* Notification Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="custom"
                  checked={notificationType === "custom"}
                  onChange={(e) => setNotificationType(e.target.value)}
                  className="w-4 h-4"
                />
                <Bell size={16} />
                <span className="text-sm">Custom Message</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="event"
                  checked={notificationType === "event"}
                  onChange={(e) => setNotificationType(e.target.value)}
                  className="w-4 h-4"
                />
                <Calendar size={16} />
                <span className="text-sm">Event Promotion</span>
              </label>
            </div>
          </div>

          {notificationType === "custom" ? (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., New Menu Items Available!"
                  maxLength={100}
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Check out our new burgers and desserts in the menu!"
                  rows={3}
                  maxLength={500}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {message.length}/500 characters
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Event Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Event *
                </label>
                <select
                  value={selectedEvent || ""}
                  onChange={(e) => setSelectedEvent(e.target.value || null)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">-- Select an event --</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Message (optional override) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Message (optional)
                </label>
                <textarea
                  value={eventMessage}
                  onChange={(e) => setEventMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Leave empty to use event description"
                  rows={2}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If empty, the event description will be used
                </p>
              </div>
            </>
          )}

          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Branches
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedBranches.includes("all")}
                  onChange={() => handleBranchChange("all")}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">All Branches</span>
              </label>
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 ml-4">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(branch.id)}
                    onChange={() => handleBranchChange(branch.id)}
                    disabled={selectedBranches.includes("all")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{branch.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Target Page */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Page (optional)
            </label>
            <select
              value={targetPage}
              onChange={(e) => setTargetPage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">None (stay on current page)</option>
              <option value="/(tabs)/home">Home</option>
              <option value="/(tabs)/menu">Menu</option>
              <option value="/(tabs)/rewards">Rewards</option>
              <option value="/(tabs)/profile">Profile</option>
              <option value="/events">Events</option>
              {notificationType === "event" && selectedEvent && (
                <option value={`/events/detail?id=${selectedEvent}`}>
                  Event Detail Page
                </option>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Where users will be taken when they tap the notification
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={sending}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={18} />
              {sending ? "Sending..." : "Send Notification"}
            </button>
          </div>
        </form>
      </div>

      {/* Notification History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Notifications
          </h3>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">Loading...</div>
        ) : history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Message</th>
                  <th className="text-left px-4 py-3">Branches</th>
                  <th className="text-left px-4 py-3">Recipients</th>
                  <th className="text-left px-4 py-3">Success Rate</th>
                  <th className="text-left px-4 py-3">Sent By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((notif) => {
                  const successRate =
                    notif.recipients_count > 0
                      ? Math.round(
                          (notif.successful_sends / notif.recipients_count) *
                            100,
                        )
                      : 0;

                  return (
                    <tr key={notif.id} className="border-t">
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(notif.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {notif.title}
                        </div>
                        {notif.event_name && (
                          <div className="text-xs text-blue-600 mt-1">
                            Event: {notif.event_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                        {notif.message}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatBranches(notif.branch_ids)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {notif.recipients_count || 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs ${
                            successRate >= 80
                              ? "bg-green-50 text-green-700"
                              : successRate >= 50
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {successRate}% ({notif.successful_sends || 0})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {notif.sent_by_name || "Unknown"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-gray-600">No notifications sent yet.</div>
        )}
      </div>
    </div>
  );
}
