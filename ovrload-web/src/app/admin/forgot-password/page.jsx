"use client";

import { useMemo, useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  const mutation = useMutation({
    mutationFn: async ({ email }) => {
      const response = await fetch("/api/admin-users/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data?.error || `Request failed (${response.status})`;
        throw new Error(msg);
      }

      return response.json().catch(() => ({}));
    },
    onSuccess: (data) => {
      setSuccess(true);
      const maybeUrl = data?.resetUrl || data?.devResetUrl || "";
      setResetUrl(maybeUrl);
    },
    onError: (err) => {
      console.error(err);
      setError(err?.message || "Could not send reset email");
    },
  });

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && !mutation.isPending;
  }, [email, mutation.isPending]);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setResetUrl("");
    mutation.mutate({ email: email.trim() });
  };

  const infoText = success
    ? "If that email is an admin account, we sent you a reset link. Check your inbox (and spam). If email isn't set up yet, you'll see a reset link here."
    : "Enter your admin email and we’ll send a password reset link.";

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
            <Mail size={40} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Forgot password
          </h1>
          <p className="text-gray-600">{infoText}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
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

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              Reset request received (if the account exists).
              {resetUrl ? (
                <div className="mt-2 break-words">
                  <div className="font-medium">Reset link:</div>
                  <a href={resetUrl} className="text-blue-700 underline">
                    {resetUrl}
                  </a>
                  <div className="mt-2 text-xs text-green-900/80">
                    (This appears when email sending isn’t configured.)
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}
