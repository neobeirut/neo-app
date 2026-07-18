"use client";

import { useState } from "react";

export default function InitAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const initializeAdmin = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin-users/init", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize admin");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Initialize Admin User
        </h1>
        <p className="mb-6 text-gray-600">
          This will create the initial admin user for accessing the admin
          dashboard in the mobile app.
        </p>

        {result && (
          <div className="mb-6 rounded-lg bg-green-50 p-4">
            <p className="font-medium text-green-800">✅ {result.message}</p>
            <div className="mt-3 space-y-2 text-sm text-green-700">
              <p>
                <strong>Email:</strong> freddykhoury@gmail.com
              </p>
              <p>
                <strong>Password:</strong> 121314
              </p>
              <p className="mt-3 text-xs">
                Use these credentials in the mobile app's "Admin Sign In"
                button.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        <button
          onClick={initializeAdmin}
          disabled={loading}
          className="w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Creating Admin User..." : "Initialize Admin User"}
        </button>

        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">📱 How to use:</p>
          <ol className="mt-2 space-y-1 text-sm text-blue-800">
            <li>1. Click the button above to create the admin user</li>
            <li>2. Open your mobile app</li>
            <li>3. Go to Profile tab</li>
            <li>4. Click "Admin Sign In" (purple button)</li>
            <li>5. Use the credentials shown above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
