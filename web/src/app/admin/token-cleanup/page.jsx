"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

export default function TokenCleanupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const cleanupOldTokens = async () => {
    if (
      !confirm(
        "This will delete all push tokens from the old development project (@create-inc/caf208ee-23f2-4e85-a97f-59206c18a02a). Users will need to log in again to re-register their devices. Continue?",
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");

      const response = await fetch("/api/admin/cleanup-old-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
          "x-admin-id": adminId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cleanup tokens");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a
            href="/admin"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Admin
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Trash2 size={24} />
            Clean Up Old Push Tokens
          </h1>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-2">Warning: Development Tokens</p>
                <p>
                  Some users have push tokens from an old development project (
                  <code className="bg-yellow-100 px-1 py-0.5 rounded">
                    @create-inc/caf208ee-23f2-4e85-a97f-59206c18a02a
                  </code>
                  ).
                </p>
                <p className="mt-2">
                  These tokens prevent notifications from being sent. Click the
                  button below to remove them. Users will automatically
                  re-register their devices when they next open the app.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={cleanupOldTokens}
            disabled={loading}
            className="bg-red-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={18} />
            {loading ? "Cleaning up..." : "Remove Old Development Tokens"}
          </button>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              ❌ {error}
            </div>
          )}

          {result && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <p className="font-medium">✅ Cleanup Complete!</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Removed {result.deletedCount} old development tokens</li>
                <li>• {result.remainingCount} valid tokens remain</li>
                <li>
                  • Affected {result.affectedUsers} users (they will re-register
                  automatically)
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">
            How does this work?
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • This only removes tokens from the old{" "}
              <code className="bg-blue-100 px-1 rounded">@create-inc</code>{" "}
              project
            </li>
            <li>
              • Your production tokens (
              <code className="bg-blue-100 px-1 rounded">
                @neo-beirut/neo-beirut
              </code>
              ) are safe
            </li>
            <li>
              • Users will get new tokens automatically when they open the app
            </li>
            <li>
              • No user data is affected, only the push notification
              registration
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
