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
      // Check Infobip configuration
      const infobipRes = await fetch("/api/admin/test-infobip-config", {
        headers: { "x-admin-token": token },
      });
      const infobipData = await infobipRes.json();

      // Check WhatsApp templates
      const templatesRes = await fetch("/api/settings/whatsapp-templates");
      const templatesData = await templatesRes.json();

      // Check branches
      const branchesRes = await fetch("/api/branches", {
        headers: { "x-admin-token": token },
      });
      const branchesData = await branchesRes.json();

      setDiagnostics({
        infobip: infobipData,
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
      // For now, use empty logs - we'll add proper endpoint later if needed
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
    diagnostics?.templates?.new_order_to_branch?.template_name
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

        {/* Infobip API Configuration */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            {diagnostics?.infobip?.configured ? (
              <CheckCircle className="text-green-600" size={24} />
            ) : (
              <XCircle className="text-red-600" size={24} />
            )}
            Infobip API Configuration
          </h2>

          {diagnostics?.infobip?.configured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded">
                <CheckCircle size={20} />
                <span>Infobip API is configured correctly</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Base URL</div>
                  <div className="font-mono text-xs">
                    {diagnostics.infobip.baseUrl}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Sender Phone / ID</div>
                  <div className="font-mono text-xs">
                    {diagnostics.infobip.sender}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 p-4 rounded">
              <p className="text-red-800 font-medium mb-2">
                ⚠️ Infobip API Not Configured
              </p>
              <p className="text-red-700 text-sm mb-3">
                {diagnostics?.infobip?.error}
              </p>
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
                    <span className="text-gray-600">Template Name:</span>{" "}
                    <code className="bg-white px-2 py-1 rounded text-xs">
                      {diagnostics?.templates?.new_order_to_branch?.template_name}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-600">Language:</span>{" "}
                    <code className="bg-white px-2 py-1 rounded text-xs">
                      {diagnostics?.templates?.new_order_to_branch?.language ||
                        diagnostics?.templates?.new_order_to_branch?.locale ||
                        "en_US"}
                    </code>
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
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>
                            <span className="text-gray-500">Name:</span>{" "}
                            {config.template_name || config.templateName || "Not configured"}
                          </div>
                          <div>
                            <span className="text-gray-500">Language:</span>{" "}
                            {config.language || config.locale || "en_US"}
                          </div>
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
                Configured Branches ({branchesWithPhone.length})
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
                Missing Phone Numbers ({branchesWithoutPhone.length})
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
      </div>
    </div>
  );
}
