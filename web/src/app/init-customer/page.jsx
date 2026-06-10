"use client";

import { useState } from "react";

export default function InitCustomerPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState("freddy@neobeirut.com");
  const [password, setPassword] = useState("121314");
  const [name, setName] = useState("Freddy");
  const [phone, setPhone] = useState("+961 3 123 456");

  const createCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/users/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create customer account");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <form
        onSubmit={createCustomer}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Create Customer Account
        </h1>
        <p className="mb-6 text-gray-600">
          This will create a customer account for signing in at /account/signin
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="+961 3 123 456"
            />
          </div>
        </div>

        {result && (
          <div className="mb-6 rounded-lg bg-green-50 p-4">
            <p className="font-medium text-green-800">✅ {result.message}</p>
            <div className="mt-3 space-y-2 text-sm text-green-700">
              <p>
                <strong>Email:</strong> {email}
              </p>
              <p>
                <strong>Password:</strong> {password}
              </p>
              <p className="mt-3">
                ➡️{" "}
                <a
                  href="/account/signin"
                  className="font-medium underline hover:text-green-900"
                >
                  Go to Sign In
                </a>
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
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Customer Account"}
        </button>

        <div className="mt-6 rounded-lg bg-yellow-50 p-4 border border-yellow-200">
          <p className="text-sm font-medium text-yellow-900">
            💡 This vs Regular Signup
          </p>
          <p className="mt-2 text-sm text-yellow-800">
            This quick tool creates a basic customer account. For full setup
            with delivery address, use{" "}
            <a
              href="/account/signup"
              className="font-medium underline hover:text-yellow-900"
            >
              /account/signup
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
