"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

export default function WhatsAppDiagnosticsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }
    setAdminToken(token);
    runDiagnostics(token);
    fetchLogs(token);
  }, []);

  const runDiagnostics = async (token) => {
    setLoading(true);
    try {
      // Check Bird configuration
      const birdRes = await fetch("/api/admin/test-bird-config", {
        headers: { "x-admin-token": token },
      });
      const birdData = await birdRes.json();

      // Check WhatsApp templates
      const templatesRes = await fetch("/api/settings/whatsapp-templates");
      const templatesData = await templatesRes.json();

      // Check branches
      const branchesRes = await fetch("/api/branches", {
        headers: { "x-admin-token": token },
      });
      const branchesData = await branchesRes.json();

      setDiagnostics({
        bird: birdData,
        templates: templatesData.templates || {},
        branches: branchesData.branches || [],
      });
    } catch (err) {
      console.error("Diagnostics failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (token) => {
    try {
      // Fetch whatsapp_logs directly for branch notifications
      const res = await fetch("/api/admin/whatsapp-inbox/conversations", {
        headers: { "x-admin-token": token },
      });

      // Get logs via a custom query
      const logsRes = await fetch("/api/admin-users/session", {
        method: "POST",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "get_whatsapp_logs" }),
      });

      // For now, use empty logs - we'll add proper endpoint later
      setLogs([]);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setLogs([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Running diagnostics...</p>
        </div>
      </div>
    );
  }

  const hasNewOrderTemplate = !!(
    diagnostics?.templates?.new_order_to_branch?.projectId ||
    process.env.BIRD_WHATSAPP_TEMPLATE_PROJECT_ID
  );

  const branchesWithPhone =
    diagnostics?.branches?.filter((b) => b.whatsapp_phone || b.phone) || [];
  const branchesWithoutPhone =
    diagnostics?.branches?.filter((b) => !b.whatsapp_phone && !b.phone) || [];

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

        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">WhatsApp Diagnostics</h1>
              <p className="text-gray-600">
                Check what's working and what needs to be configured
              </p>
            </div>
            <button
              onClick={() => {
                runDiagnostics(adminToken);
                fetchLogs(adminToken);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Bird API Configuration */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            {diagnostics?.bird?.configured ? (
              <CheckCircle className="text-green-600" size={24} />
            ) : (
              <XCircle className="text-red-600" size={24} />
            )}
            Bird API Configuration
          </h2>

          {diagnostics?.bird?.configured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded">
                <CheckCircle size={20} />
                <span>Bird API is configured correctly</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Workspace ID</div>
                  <div className="font-mono text-xs">
                    {diagnostics.bird.workspaceId}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Channel ID</div>
                  <div className="font-mono text-xs">
                    {diagnostics.bird.channelId}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 p-4 rounded">
              <p className="text-red-800 font-medium mb-2">
                ⚠️ Bird API Not Configured
              </p>
              <p className="text-red-700 text-sm mb-3">
                {diagnostics?.bird?.error}
              </p>
              <a
                href="/admin/whatsapp-setup"
                className="inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                View Setup Guide
              </a>
            </div>
          )}
        </div>

        {/* Templates Configuration */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            {hasNewOrderTemplate ? (
              <CheckCircle className="text-green-600" size={24} />
            ) : (
              <AlertTriangle className="text-yellow-600" size={24} />
            )}
            WhatsApp Templates
          </h2>

          <div className="space-y-3">
            {/* New Order to Branch Template */}
            <div
              className={`p-4 rounded border ${
                hasNewOrderTemplate
                  ? "bg-green-50 border-green-200"
                  : "bg-yellow-50 border-yellow-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">
                  New Order to Branch Template
                </div>
                {hasNewOrderTemplate ? (
                  <CheckCircle className="text-green-600" size={20} />
                ) : (
                  <AlertTriangle className="text-yellow-600" size={20} />
                )}
              </div>
              {hasNewOrderTemplate ? (
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-600">Project ID:</span>{" "}
                    <code className="bg-white px-2 py-1 rounded text-xs">
                      {diagnostics?.templates?.new_order_to_branch?.projectId ||
                        process.env.BIRD_WHATSAPP_TEMPLATE_PROJECT_ID}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-600">Version:</span>{" "}
                    {diagnostics?.templates?.new_order_to_branch?.version ||
                      "latest"}
                  </div>
                  <div>
                    <span className="text-gray-600">Locale:</span>{" "}
                    {diagnostics?.templates?.new_order_to_branch?.locale ||
                      "en"}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-yellow-800">
                  <p className="mb-2">
                    This template is required to notify branches about new
                    orders
                  </p>
                  <a href="/admin" className="text-blue-600 hover:underline">
                    Configure in Settings → WhatsApp Templates
                  </a>
                </div>
              )}
            </div>

            {/* Customer Status Templates */}
            {Object.keys(diagnostics?.templates || {}).length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">
                  Customer Status Templates
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(diagnostics.templates)
                    .filter(([key]) => key !== "new_order_to_branch")
                    .map(([key, config]) => (
                      <div
                        key={key}
                        className="bg-gray-50 p-3 rounded border border-gray-200"
                      >
                        <div className="font-medium text-sm mb-1">
                          {key.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-gray-600">
                          {config.templateName || "Not configured"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Branches Configuration */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            {branchesWithoutPhone.length === 0 ? (
              <CheckCircle className="text-green-600" size={24} />
            ) : (
              <AlertTriangle className="text-yellow-600" size={24} />
            )}
            Branch Phone Numbers
          </h2>

          {branchesWithPhone.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-green-700 mb-2">
                ✓ Configured Branches ({branchesWithPhone.length})
              </h3>
              <div className="space-y-2">
                {branchesWithPhone.map((branch) => (
                  <div
                    key={branch.id}
                    className="bg-green-50 border border-green-200 p-3 rounded"
                  >
                    <div className="font-medium">{branch.name}</div>
                    <div className="text-sm text-gray-600">
                      {branch.whatsapp_phone || branch.phone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {branchesWithoutPhone.length > 0 && (
            <div>
              <h3 className="font-semibold text-yellow-700 mb-2">
                ⚠ Missing Phone Numbers ({branchesWithoutPhone.length})
              </h3>
              <div className="space-y-2">
                {branchesWithoutPhone.map((branch) => (
                  <div
                    key={branch.id}
                    className="bg-yellow-50 border border-yellow-200 p-3 rounded"
                  >
                    <div className="font-medium">{branch.name}</div>
                    <div className="text-sm text-yellow-700">
                      No phone number configured
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Add WhatsApp phone numbers in{" "}
                <a href="/admin" className="text-blue-600 hover:underline">
                  Admin → Branches
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Recent Logs */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Recent WhatsApp Logs</h2>

          {logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No logs yet</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded border text-sm ${
                    log.status === "sent"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">
                      Order #{log.order_id} → {log.to_phone}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Status:</span>{" "}
                    <span
                      className={
                        log.status === "sent"
                          ? "text-green-700 font-medium"
                          : "text-red-700 font-medium"
                      }
                    >
                      {log.status}
                    </span>
                  </div>
                  {log.error && (
                    <div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded">
                      {log.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
