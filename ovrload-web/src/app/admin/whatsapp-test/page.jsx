"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, RefreshCw, Send, Zap } from "lucide-react";

export default function WhatsAppTestPage() {
  const [adminToken, setAdminToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [logs, setLogs] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [birdConfig, setBirdConfig] = useState(null);
  const [testPhone, setTestPhone] = useState("+96170123456");
  const [debugPhone, setDebugPhone] = useState("+9613361515");
  const [debugResult, setDebugResult] = useState(null);

  const fetchLogs = async (token) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp-inbox/debug-logs", {
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const testBirdConfig = async (token) => {
    try {
      const res = await fetch("/api/admin/test-bird-config", {
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      setBirdConfig(data);
    } catch (err) {
      console.error("Failed to test Bird config:", err);
    }
  };

  const runManualTest = async () => {
    setTestResult(null);
    try {
      const testPayload = {
        from: testPhone,
        message: {
          text: { text: "Test message from Bird webhook" },
        },
        timestamp: new Date().toISOString(),
        id: "test_" + Date.now(),
      };

      const res = await fetch("/api/webhooks/whatsapp/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });

      const data = await res.json();
      setTestResult({
        success: res.ok,
        status: res.status,
        data,
      });

      // Refresh logs
      await fetchLogs(adminToken);
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message,
      });
    }
  };

  const debugPhoneData = async () => {
    setDebugResult(null);
    try {
      const res = await fetch(
        `/api/admin/whatsapp-inbox/debug-phone?phone=${encodeURIComponent(debugPhone)}`,
        {
          headers: { "x-admin-token": adminToken },
        },
      );
      const data = await res.json();
      setDebugResult(data);
    } catch (err) {
      setDebugResult({
        ok: false,
        error: err.message,
      });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }
    setAdminToken(token);
    setCheckingAuth(false);
    setLoading(false);
    fetchLogs(token);
    testBirdConfig(token);
  }, []);

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/whatsapp/inbound`
      : "";

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <div className="mb-4">
          <button
            onClick={() => (window.location.href = "/admin")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            ← Back to Admin Panel
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="text-yellow-500" />
            WhatsApp Webhook Diagnostics
          </h1>

          {/* Bird Configuration Test */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="font-semibold text-blue-900 mb-2">
              Bird API Configuration
            </h2>
            {birdConfig ? (
              <div className="space-y-2 text-sm">
                {birdConfig.configured ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={16} />
                    <span>Bird API credentials are configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle size={16} />
                    <span>{birdConfig.error}</span>
                  </div>
                )}
                {birdConfig.workspaceId && (
                  <div className="text-gray-700">
                    <strong>Workspace:</strong> {birdConfig.workspaceId}
                  </div>
                )}
                {birdConfig.channelId && (
                  <div className="text-gray-700">
                    <strong>Channel:</strong> {birdConfig.channelId}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">Loading...</div>
            )}
          </div>

          {/* Webhook URL */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h2 className="font-semibold text-purple-900 mb-2">
              Your Webhook URL
            </h2>
            <div className="bg-white p-3 rounded border border-purple-300 font-mono text-sm break-all">
              {webhookUrl}
            </div>
            <p className="text-xs text-purple-700 mt-2">
              ☝️ Configure this in Bird Dashboard → Channels → WhatsApp →
              Webhooks
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Event to select: <strong>whatsapp.inbound</strong>
            </p>
          </div>

          {/* Phone Number Debug Section */}
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h2 className="font-semibold text-orange-900 mb-2">
              🔍 Debug Specific Phone Number
            </h2>
            <p className="text-xs text-orange-700 mb-3">
              Check what data exists for a specific customer phone number
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={debugPhone}
                onChange={(e) => setDebugPhone(e.target.value)}
                placeholder="+9613361515"
                className="flex-1 px-4 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={debugPhoneData}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
              >
                Debug
              </button>
            </div>
          </div>

          {/* Debug Result */}
          {debugResult && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-2 text-gray-900">
                Debug Results for {debugPhone}
              </h3>
              <div className="space-y-3">
                {debugResult.debug?.customers?.length > 0 ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      ✅ Customer Found
                    </p>
                    <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                      {JSON.stringify(debugResult.debug.customers, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-semibold text-red-900">
                      ❌ No Customer Found
                    </p>
                  </div>
                )}

                {debugResult.debug?.conversations?.length > 0 ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      ✅ Conversation Found
                    </p>
                    <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                      {JSON.stringify(debugResult.debug.conversations, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-semibold text-red-900">
                      ❌ No Conversation Found
                    </p>
                  </div>
                )}

                {debugResult.debug?.messages?.length > 0 ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      ✅ {debugResult.debug.messages.length} Messages Found
                    </p>
                    <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-64">
                      {JSON.stringify(debugResult.debug.messages, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-semibold text-red-900">
                      ❌ No Messages Found
                    </p>
                  </div>
                )}

                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Admin Info
                  </p>
                  <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                    {JSON.stringify(debugResult.debug?.adminInfo, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Manual Test Button */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Test Phone Number
            </label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+96170123456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={runManualTest}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              <Send size={20} />
              Send Test Webhook
            </button>
            <p className="text-xs text-gray-600 mt-2">
              This simulates Bird sending a webhook to your server. Use a real
              customer phone to test full functionality.
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                testResult.success
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <h3
                className={`font-semibold mb-2 flex items-center gap-2 ${
                  testResult.success ? "text-green-900" : "text-red-900"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                Test Result
              </h3>
              <pre className="text-xs bg-white p-3 rounded overflow-x-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchLogs(adminToken)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh Logs
          </button>
        </div>

        {/* Debug Logs */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            Recent Webhook Activity ({logs.length})
          </h2>

          {logs.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No webhooks received yet</p>
              <p className="text-sm text-gray-400">
                Click "Send Test Webhook" above to verify your endpoint works
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          log.phone === "DEBUG" || log.phone === "WEBHOOK_DEBUG"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.phone}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.status === "received"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <pre className="text-xs bg-black text-green-400 p-3 rounded overflow-x-auto font-mono">
                    {log.message_text}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
