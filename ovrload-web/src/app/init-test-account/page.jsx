"use client";

import { useState } from "react";

export default function InitTestAccountPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/auth/init-test-account", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize test account");
      }

      setResult(data);
    } catch (err) {
      console.error("Error initializing test account:", err);
      setError(err.message || "Failed to initialize test account");
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/auth/init-test-account", {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check test account");
      }

      setResult(data);
    } catch (err) {
      console.error("Error checking test account:", err);
      setError(err.message || "Failed to check test account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          padding: "32px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            marginBottom: "8px",
            color: "#1F2937",
          }}
        >
          Apple Review Test Account
        </h1>
        <p style={{ fontSize: "16px", color: "#6B7280", marginBottom: "32px" }}>
          Initialize or check the Apple Review test account for app submission.
        </p>

        <div
          style={{
            backgroundColor: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#1E40AF",
              marginBottom: "12px",
            }}
          >
            Test Account Credentials
          </h3>
          <div
            style={{ fontSize: "14px", color: "#1F2937", lineHeight: "1.6" }}
          >
            <p>
              <strong>Phone Number:</strong> +961 1 234 567
            </p>
            <p>
              <strong>Verification Code:</strong> 123456
            </p>
            <p
              style={{ marginTop: "12px", fontSize: "13px", color: "#6B7280" }}
            >
              This account bypasses all SMS, WhatsApp, and verification code
              requirements. The verification code is fixed and never expires
              during the review period.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={handleInitialize}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: loading ? "#9CA3AF" : "#357AFF",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {loading ? "Processing..." : "Initialize Test Account"}
          </button>

          <button
            onClick={handleCheck}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: loading ? "#9CA3AF" : "#10B981",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {loading ? "Checking..." : "Check Status"}
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#991B1B",
                marginBottom: "8px",
              }}
            >
              Error
            </h3>
            <p style={{ fontSize: "14px", color: "#7F1D1D" }}>{error}</p>
          </div>
        )}

        {result && (
          <div
            style={{
              backgroundColor: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#166534",
                marginBottom: "12px",
              }}
            >
              {result.exists !== undefined ? "Status Check" : "Success"}
            </h3>
            <div
              style={{ fontSize: "14px", color: "#14532D", lineHeight: "1.6" }}
            >
              <p style={{ marginBottom: "8px" }}>
                <strong>Message:</strong> {result.message}
              </p>
              {result.user && (
                <>
                  <p>
                    <strong>User ID:</strong> {result.user.id}
                  </p>
                  <p>
                    <strong>Name:</strong> {result.user.first_name}{" "}
                    {result.user.last_name}
                  </p>
                  <p>
                    <strong>Phone:</strong> {result.user.phone}
                  </p>
                  {result.user.points !== undefined && (
                    <p>
                      <strong>Points:</strong> {result.user.points}
                    </p>
                  )}
                  {result.user.membership_tier && (
                    <p>
                      <strong>Tier:</strong> {result.user.membership_tier}
                    </p>
                  )}
                  <p>
                    <strong>Active:</strong>{" "}
                    {result.user.is_active ? "Yes" : "No"}
                  </p>
                </>
              )}
              {result.credentials && (
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid #BBF7D0",
                  }}
                >
                  <p>
                    <strong>Phone:</strong> {result.credentials.phone}
                  </p>
                  <p>
                    <strong>Code:</strong> {result.credentials.code}
                  </p>
                  {result.credentials.note && (
                    <p style={{ fontSize: "13px", marginTop: "8px" }}>
                      {result.credentials.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "32px",
            paddingTop: "24px",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "12px",
            }}
          >
            Instructions for Apple App Review
          </h3>
          <ol
            style={{
              fontSize: "14px",
              color: "#6B7280",
              lineHeight: "1.8",
              paddingLeft: "20px",
            }}
          >
            <li>Open the mobile app</li>
            <li>
              On the sign-in screen, enter phone number:{" "}
              <code
                style={{
                  backgroundColor: "#F3F4F6",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                +961 1 234 567
              </code>
            </li>
            <li>Tap "Send Verification Code"</li>
            <li>
              Enter the verification code:{" "}
              <code
                style={{
                  backgroundColor: "#F3F4F6",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                123456
              </code>
            </li>
            <li>
              You will be instantly logged in without waiting for SMS or
              WhatsApp
            </li>
          </ol>
          <p
            style={{
              fontSize: "13px",
              color: "#9CA3AF",
              marginTop: "16px",
              fontStyle: "italic",
            }}
          >
            Note: This test account has pre-populated data including loyalty
            points and order history to demonstrate the full functionality of
            the app.
          </p>
        </div>
      </div>
    </div>
  );
}
