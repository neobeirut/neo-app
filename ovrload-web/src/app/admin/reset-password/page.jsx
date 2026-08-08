"use client";

import { useMemo, useState } from "react";
import { KeyRound, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

function getTokenFromSearch() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

export default function AdminResetPasswordPage() {
  const [token] = useState(() => getTokenFromSearch());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ token, password }) => {
      const response = await fetch("/api/admin-users/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = data?.error || `Reset failed (${response.status})`;
        throw new Error(msg);
      }

      return data;
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err) => {
      console.error(err);
      setError(err?.message || "Could not reset password");
    },
  });

  const tokenMissing = !token;

  const passwordsMismatch =
    password.length > 0 && confirm.length > 0 && password !== confirm;

  const canSubmit = useMemo(() => {
    if (tokenMissing) return false;
    if (mutation.isPending) return false;
    if (password.length < 8) return false;
    if (password !== confirm) return false;
    return true;
  }, [tokenMissing, mutation.isPending, password, confirm]);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    mutation.mutate({ token, password });
  };

  const helpText = tokenMissing
    ? "This reset link is missing a token. Please request a new reset link."
    : "Choose a new password (at least 8 characters).";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="mb-6">
          <a
            href="/admin/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to login
          </a>
        </div>

        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
            <KeyRound size={40} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Reset password
          </h1>
          <p className="text-gray-600">{helpText}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={tokenMissing || mutation.isPending || success}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={tokenMissing || mutation.isPending || success}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
              placeholder="Re-enter password"
            />
          </div>

          {passwordsMismatch && !success && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg text-sm">
              Passwords do not match.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              Password updated. You can now sign in.
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Updating..." : "Update password"}
          </button>

          {!success && (
            <div className="text-center">
              <a
                href="/admin/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Request a new reset link
              </a>
            </div>
          )}

          {success && (
            <div className="text-center">
              <a
                href="/admin/login"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to login
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
