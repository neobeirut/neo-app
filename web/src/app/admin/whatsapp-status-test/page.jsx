"use client";

import { useState } from "react";

export default function WhatsAppStatusTestPage() {
  const [phone, setPhone] = useState("+961");
  const [status, setStatus] = useState("preparing");
  const [orderType, setOrderType] = useState("delivery");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/test-whatsapp-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          status,
          orderType,
        }),
      });

      const data = await response.json();
      setResult({
        status: response.status,
        ok: response.ok,
        data,
      });

      // Scroll to result
      setTimeout(() => {
        document
          .getElementById("result")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      setResult({
        status: 0,
        ok: false,
        data: {
          error: error.message,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-2">
            WhatsApp Status Update Test
          </h1>
          <p className="text-gray-600 mb-8">
            Direct test for WhatsApp status updates (bypasses auth/session)
          </p>

          <div className="space-y-6">
            {/* Phone Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+96176123456"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lebanese number in E.164 format (+961...)
              </p>
            </div>

            {/* Status Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Order Type Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
              </select>
            </div>

            {/* Send Button */}
            <button
              onClick={handleTest}
              disabled={loading || !phone || !status || !orderType}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white ${
                loading || !phone || !status || !orderType
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Sending..." : "Send WhatsApp Test"}
            </button>

            {/* Check Logs Reminder */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>📋 Check your server logs/terminal!</strong>
                <br />
                All diagnostic output will appear in your server console, not
                here.
                <br />
                Look for boxes with diagnostic information.
              </p>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div id="result" className="mt-8 border-t pt-8">
              <h2 className="text-xl font-semibold mb-4">
                {result.ok ? "✅ Success" : "❌ Error"}
              </h2>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  HTTP Status:{" "}
                  <span className="font-mono">{result.status}</span>
                </div>
              </div>

              <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg overflow-auto max-h-96">
                <pre>{JSON.stringify(result.data, null, 2)}</pre>
              </div>

              {!result.ok && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Error occurred.</strong> Check the server logs for
                    detailed diagnostic output.
                  </p>
                </div>
              )}

              {result.ok && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>WhatsApp sent successfully!</strong>
                    <br />
                    Message ID:{" "}
                    <code className="font-mono">
                      {result.data?.messageId || "N/A"}
                    </code>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            How to Use This Test
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Enter a Lebanese phone number (+961...)</li>
            <li>Select the order status to test (e.g., "preparing")</li>
            <li>Select order type (delivery or pickup)</li>
            <li>Click "Send WhatsApp Test"</li>
            <li>
              <strong>Check your server terminal/logs</strong> for diagnostic
              output
            </li>
            <li>
              Look for boxes showing template config, payload, and Infobip
              response
            </li>
          </ol>

          <div className="mt-4 pt-4 border-t border-blue-300">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> This test bypasses authentication and
              session checks. It directly calls the WhatsApp sending function
              with the template configured in Admin → Settings → WhatsApp
              Templates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
