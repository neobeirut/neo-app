"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin-users/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Store admin credentials in localStorage
      localStorage.setItem("admin_email", data.user.email);
      localStorage.setItem("admin_name", data.user.name);
      localStorage.setItem("admin_id", data.user.id);
      if (data.adminToken) {
        localStorage.setItem("admin_token", data.adminToken);
      }
      // NEW: store roles so the admin UI can hide/show tabs
      localStorage.setItem(
        "admin_roles",
        JSON.stringify(Array.isArray(data.user.roles) ? data.user.roles : []),
      );

      // Redirect to admin dashboard
      window.location.href = "/admin";
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
            <LogIn size={40} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Neo Beirut Admin
          </h1>
          <p className="text-gray-600">Sign in to access the admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="admin@bakery.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={20} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <a
            href="/admin/forgot-password"
            className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Forgot your password?
          </a>
          <div className="text-xs text-gray-600">
            Admin access is email + password only.
          </div>
          <a
            href="/admin/account-recovery"
            className="block text-xs text-gray-600 hover:text-gray-900"
          >
            Have a reset link/token? Set a new password
          </a>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a
              href="/init-admin"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Initialize Admin
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
