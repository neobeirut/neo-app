"use client";

import { useState, useEffect } from "react";

function MainComponent() {
  const [error, setError] = useState(null);
  const [callbackUrl, setCallbackUrl] = useState("/");

  // Phone auth state
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const callback = params.get("callbackUrl");
      if (callback) {
        setCallbackUrl(callback);
      }
    }
  }, []);

  // Phone signin - send code
  const sendVerificationCode = async () => {
    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }

    setPhoneLoading(true);
    setError(null);

    try {
      // First, check if phone number exists and get user data
      const checkResponse = await fetch("/api/auth/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const checkData = await checkResponse.json();

      // Check if account is deleted/inactive
      if (
        !checkResponse.ok &&
        checkData.error === "This account has been deleted"
      ) {
        setError(
          "This account has been deleted and cannot be used to sign in. Please contact support or create a new account with a different phone number.",
        );
        setPhoneLoading(false);
        return;
      }

      if (!checkResponse.ok || !checkData.exists) {
        // Phone number doesn't exist - redirect to signup
        setError(
          "No account found with this phone number. Please sign up first.",
        );
        setPhoneLoading(false);
        return;
      }

      // Phone exists, now send verification code
      const response = await fetch("/api/auth/phone-send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), channel: "whatsapp" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      setCodeSent(true);
    } catch (err) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setPhoneLoading(false);
    }
  };

  // Phone signin - verify code
  const verifyPhoneCode = async (e) => {
    e.preventDefault();

    if (!verificationCode.trim()) {
      setError("Please enter the verification code");
      return;
    }

    setPhoneLoading(true);
    setError(null);

    try {
      console.log("[SIGNIN] Step 1: Verifying code for phone:", phone.trim());

      // First verify the code
      const verifyResponse = await fetch("/api/auth/phone-verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          code: verificationCode.trim(),
        }),
      });

      const verifyData = await verifyResponse.json();
      console.log("[SIGNIN] Step 1 response:", {
        ok: verifyResponse.ok,
        status: verifyResponse.status,
        data: verifyData,
      });

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || "Invalid verification code");
      }

      console.log("[SIGNIN] Step 2: Checking if user exists");

      // Then check if user exists
      const phoneCheckResponse = await fetch("/api/auth/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const phoneCheckData = await phoneCheckResponse.json();
      console.log("[SIGNIN] Step 2 response:", {
        ok: phoneCheckResponse.ok,
        status: phoneCheckResponse.status,
        data: phoneCheckData,
      });

      if (!phoneCheckResponse.ok || !phoneCheckData.exists) {
        setError(
          "No account found with this phone number. Please sign up first.",
        );
        setPhoneLoading(false);
        return;
      }

      // Use the canonical phone from the user object returned by phone-verify
      const canonicalPhone = phoneCheckData.user?.phone || phone.trim();
      console.log("[SIGNIN] Step 3: Using canonical phone:", canonicalPhone);

      // Get auth token using canonical phone
      const tokenResponse = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: canonicalPhone }),
        credentials: "include",
      });

      const tokenData = await tokenResponse.json();
      console.log("[SIGNIN] Step 3 response:", {
        ok: tokenResponse.ok,
        status: tokenResponse.status,
        data: tokenData,
      });

      if (tokenResponse.ok) {
        console.log("[SIGNIN] Success! Redirecting to:", callbackUrl);
        // Redirect to callback URL
        window.location.href = callbackUrl;
      } else {
        console.error("[SIGNIN] Token error:", tokenData);
        throw new Error(
          tokenData.error || tokenData.details || "Failed to authenticate",
        );
      }
    } catch (err) {
      console.error("Phone verification error:", err);
      setError(err.message || "Failed to verify code");
      setPhoneLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-800">
          Welcome Back
        </h1>

        {/* Phone Sign In Form */}
        <div className="space-y-6">
          {!codeSent ? (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-[#357AFF] focus-within:ring-1 focus-within:ring-[#357AFF]">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+961 3 123456"
                    className="w-full bg-transparent text-lg outline-none placeholder:text-gray-400"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  We'll send a verification code via WhatsApp
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={sendVerificationCode}
                disabled={phoneLoading}
                className="w-full rounded-lg bg-[#357AFF] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#2E69DE] focus:outline-none focus:ring-2 focus:ring-[#357AFF] focus:ring-offset-2 disabled:opacity-50"
              >
                {phoneLoading ? "Sending..." : "Send WhatsApp Code"}
              </button>
            </>
          ) : (
            <form onSubmit={verifyPhoneCode} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-[#357AFF] focus-within:ring-1 focus-within:ring-[#357AFF]">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full bg-transparent text-lg outline-none placeholder:text-gray-400 text-center tracking-widest"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Enter the code sent to {phone} via WhatsApp
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={phoneLoading}
                className="w-full rounded-lg bg-[#357AFF] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#2E69DE] focus:outline-none focus:ring-2 focus:ring-[#357AFF] focus:ring-offset-2 disabled:opacity-50"
              >
                {phoneLoading ? "Verifying..." : "Verify & Sign In"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setVerificationCode("");
                  setError(null);
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-900"
              >
                Use a different number
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <a
            href={`/account/signup${typeof window !== "undefined" ? window.location.search : ""}`}
            className="text-[#357AFF] hover:text-[#2E69DE]"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default MainComponent;
