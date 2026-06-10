"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Link as LinkIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

function extractTokenFromInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // If the user pasted a full URL, try to parse ?token=
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      return url.searchParams.get("token") || "";
    } catch (e) {
      // fall through
    }
  }

  // If they pasted the token itself, accept it.
  return raw;
}

export default function AdminAccountRecoveryPage() {
  const [resetLinkOrToken, setResetLinkOrToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const token = useMemo(() => {
    return extractTokenFromInput(resetLinkOrToken);
  }, [resetLinkOrToken]);

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
    if (success) return false;
    return true;
  }, [tokenMissing, mutation.isPending, password, confirm, success]);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    mutation.mutate({ token, password });
  };

  const helpText =
    "Admin recovery is email + password only. First request a reset link, then paste the link (or token) here to set a new admin password.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="mb-6">
          <a
            href="/admin/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to admin login
          </a>
        </div>

        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
            <KeyRound size={40} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin account recovery
          </h1>
          <p className="text-gray-600">{helpText}</p>
        </div>

        <div className="mb-4">
          <a
            href="/admin/forgot-password"
            className="w-full inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Request a reset link
          </a>
          <div className="mt-2 text-xs text-gray-500">
            If email sending isn’t set up, the reset link will appear on that
            page.
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="resetLinkOrToken"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Reset link or token
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <LinkIcon size={16} />
              </div>
              <input
                id="resetLinkOrToken"
                type="text"
                value={resetLinkOrToken}
                onChange={(e) => setResetLinkOrToken(e.target.value)}
                disabled={mutation.isPending || success}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                placeholder="Paste the full /admin/reset-password?token=... link"
              />
            </div>
            {!tokenMissing ? (
              <div className="mt-2 text-xs text-gray-500 break-words">
                Token detected: <span className="font-mono">{token}</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-500">
                Paste the reset link from the forgot password page.
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              New Admin Password
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

          {passwordsMismatch && !success ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg text-sm">
              Passwords do not match.
            </div>
          ) : null}

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              Admin password updated. You can now sign in.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Updating..." : "Update admin password"}
          </button>

          {success ? (
            <div className="text-center">
              <a
                href="/admin/login"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to admin login
              </a>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
