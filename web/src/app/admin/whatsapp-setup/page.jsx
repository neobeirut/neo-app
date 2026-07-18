"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

export default function WhatsAppSetupPage() {
  const [adminToken, setAdminToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [infobipConfig, setInfobipConfig] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }
    setAdminToken(token);
    testInfobipConfig(token);
  }, []);

  const testInfobipConfig = async (token) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-whatsapp", {
        method: "POST",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setInfobipConfig(data);
    } catch (err) {
      console.error("Failed to test Infobip config:", err);
      setInfobipConfig({
        ok: false,
        error: "Failed to check configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/whatsapp/inbound`
      : "";

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
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
          <h1 className="text-3xl font-bold mb-2">
            WhatsApp Inbox Setup Guide
          </h1>
          <p className="text-gray-600">
            Follow these steps to enable WhatsApp messaging for your customers
            using Infobip
          </p>
        </div>

        {/* Status Check */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            {infobipConfig?.ok ? (
              <CheckCircle className="text-green-600" size={24} />
            ) : (
              <XCircle className="text-red-600" size={24} />
            )}
            Configuration Status
          </h2>

          {infobipConfig?.ok ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded">
                <CheckCircle size={20} />
                <span className="font-medium">
                  Infobip API is configured correctly!
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Base URL</div>
                  <div className="font-mono text-xs">
                    {infobipConfig.config?.baseUrl}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Sender</div>
                  <div className="font-mono text-xs">
                    {infobipConfig.config?.sender}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">API Key</div>
                  <div className="font-mono text-xs">
                    ****{infobipConfig.config?.apiKeyLast4}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 mb-1">Authentication</div>
                  <div className="font-mono text-xs text-green-600">
                    ✅ Verified
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 p-4 rounded">
              <p className="text-red-800 font-medium mb-2">
                ⚠️ Infobip API Not Configured
              </p>
              <p className="text-red-700 text-sm">{infobipConfig?.error}</p>
              <p className="text-red-600 text-xs mt-2">{infobipConfig?.hint}</p>
            </div>
          )}
        </div>

        {/* Setup Steps */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-6">Setup Steps</h2>

          {/* Step 1 */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">
                  Create Infobip Account
                </h3>
                <p className="text-gray-600 mb-3">
                  Sign up for an Infobip account and set up a WhatsApp Business
                  channel
                </p>
                <a
                  href="https://www.infobip.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Go to Infobip.com
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">
                  Get API Credentials
                </h3>
                <p className="text-gray-600 mb-3">
                  In Infobip dashboard, go to{" "}
                  <strong>Settings → API Keys</strong> and create a new API key
                </p>
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm">
                  <strong>You'll need:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>API Key</li>
                    <li>Base URL (e.g., https://y4r1q1.api.infobip.com)</li>
                    <li>WhatsApp Sender Number (e.g., 96176489078)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">
                  Add Environment Variables
                </h3>
                <p className="text-gray-600 mb-3">
                  In your Anything project settings, add these environment
                  variables:
                </p>
                <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm space-y-2">
                  <div>INFOBIP_API_KEY=your_api_key_here</div>
                  <div>INFOBIP_BASE_URL=https://y4r1q1.api.infobip.com</div>
                  <div>INFOBIP_WHATSAPP_SENDER=96176489078</div>
                </div>
                <div className="mt-3 bg-blue-50 border border-blue-200 p-3 rounded text-sm">
                  <strong>💡 Tip:</strong> You can find these in your Anything
                  project's Secrets section
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">
                  Configure Webhook in Infobip (Optional)
                </h3>
                <p className="text-gray-600 mb-3">
                  To receive inbound messages from customers, configure a
                  webhook in Infobip dashboard
                </p>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Webhook URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={webhookUrl}
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 rounded bg-gray-50 font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(webhookUrl)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm space-y-2">
                  <div>
                    <strong>Event to select:</strong>{" "}
                    <code className="bg-yellow-100 px-2 py-1 rounded">
                      whatsapp.inbound
                    </code>
                  </div>
                  <div>
                    <strong>Method:</strong> POST
                  </div>
                  <div>
                    <strong>URL:</strong> Paste the webhook URL above
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Test Your Setup</h3>
                <p className="text-gray-600 mb-3">
                  Use the WhatsApp Test page to verify everything is working
                </p>
                <button
                  onClick={() =>
                    (window.location.href = "/admin/whatsapp-test")
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Go to Test Page
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Common Issues */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-yellow-600" />
            Common Issues
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold mb-1">
                Authentication Failed (401/403)
              </h3>
              <p className="text-sm text-gray-600">
                Check that INFOBIP_API_KEY is correct and that INFOBIP_BASE_URL
                matches your account region
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold mb-1">Cannot send messages</h3>
              <p className="text-sm text-gray-600">
                Verify that your WhatsApp number is correctly set in
                INFOBIP_WHATSAPP_SENDER (format: 96176489078)
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold mb-1">Wrong Base URL</h3>
              <p className="text-sm text-gray-600">
                Make sure INFOBIP_BASE_URL includes the full URL including
                https:// (example: https://y4r1q1.api.infobip.com)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
