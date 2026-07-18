"use client";

import { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function PushDiagnosticsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!userId && !userEmail) {
      setError("Please enter a User ID or Email");
      return;
    }

    setLoading(true);
    setError(null);
    setDiagnostics(null);
    setTestResult(null);

    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");

      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (userEmail) params.append("email", userEmail);

      const response = await fetch(
        `/api/users/push-token/diagnostics?${params}`,
        {
          headers: {
            "x-admin-token": adminToken,
            "x-admin-id": adminId,
          },
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error: ${response.status}`);
      }

      const data = await response.json();
      setDiagnostics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!diagnostics?.user_id) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");

      const response = await fetch("/api/users/push-token/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
          "x-admin-id": adminId,
        },
        body: JSON.stringify({
          userId: diagnostics.user_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`);
      }

      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_roles");
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Push Notification Diagnostics
            </h1>
            <p className="text-gray-600 mt-1">
              Check if users can receive push notifications
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin"
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to Admin
            </a>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., 123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., user@example.com"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Search size={18} />
              {loading ? "Searching..." : "Search User"}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Diagnostics Results */}
        {diagnostics && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">User Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">User ID</p>
                  <p className="font-medium">{diagnostics.user_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">
                    {diagnostics.user_email || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">
                    {diagnostics.user_phone || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="font-medium">
                    {diagnostics.user_active ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-red-600">No</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Push Token Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                Push Token Status
                {diagnostics.has_tokens ? (
                  <CheckCircle size={20} className="text-green-600" />
                ) : (
                  <XCircle size={20} className="text-red-600" />
                )}
              </h2>

              {diagnostics.has_tokens ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle size={18} className="text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">
                        User has {diagnostics.tokens.length} push token(s)
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        This user can receive push notifications
                      </p>
                    </div>
                  </div>

                  {diagnostics.tokens.map((token, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">Platform</p>
                          <p className="font-medium">
                            {token.platform || "Unknown"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Last Updated</p>
                          <p className="font-medium">
                            {new Date(token.updated_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600">
                            Token (first 50 chars)
                          </p>
                          <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                            {token.token.substring(0, 50)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Test Button */}
                  <button
                    onClick={handleTestNotification}
                    disabled={testLoading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Send size={18} />
                    {testLoading ? "Sending..." : "Send Test Notification"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <XCircle size={18} className="text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">
                        No push tokens found
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        This user cannot receive push notifications
                      </p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={18}
                        className="text-yellow-600 mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-yellow-900">
                          Why might this happen?
                        </p>
                        <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                          <li>
                            User denied notification permission in device
                            settings
                          </li>
                          <li>User hasn't opened the app after installation</li>
                          <li>User logged out or cleared app data</li>
                          <li>
                            App doesn't have permission to show notifications
                          </li>
                        </ul>
                        <p className="text-sm text-yellow-800 mt-3">
                          <strong>Solution:</strong> Ask the user to:
                        </p>
                        <ol className="text-sm text-yellow-800 mt-1 space-y-1 list-decimal list-inside ml-4">
                          <li>Open the mobile app</li>
                          <li>Go to Profile → Notification Settings</li>
                          <li>Enable notifications</li>
                          <li>
                            If prompted, allow notifications in device settings
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Result */}
            {testResult && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Test Result</h2>
                {testResult.success ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle
                        size={18}
                        className="text-green-600 mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-green-900">
                          Notification sent successfully!
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          Sent to {testResult.sentCount} device(s)
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-900">
                        📱 Check the user's device - they should see a
                        notification that says:
                      </p>
                      <div className="mt-2 p-3 bg-white border rounded-lg">
                        <p className="font-semibold text-sm">
                          Test Notification
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          This is a test notification from the admin panel
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <XCircle size={18} className="text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">
                        Failed to send notification
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {testResult.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!diagnostics && !error && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              How to use this tool:
            </h3>
            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
              <li>Enter a User ID or Email above</li>
              <li>
                Click "Search User" to check their push notification status
              </li>
              <li>If they have tokens, you can send a test notification</li>
              <li>Check the user's device to confirm they received it</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
