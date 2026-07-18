export default function AppleReviewInstructionsPage() {
  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          padding: "40px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "12px",
            color: "#1F2937",
          }}
        >
          Apple App Review - Test Account Instructions
        </h1>
        <p style={{ fontSize: "14px", color: "#9CA3AF", marginBottom: "32px" }}>
          Last Updated: February 2025 • Test Account Status: Active and Ready
          for Review
        </p>

        {/* Test Credentials */}
        <div
          style={{
            backgroundColor: "#F0F9FF",
            border: "2px solid #0EA5E9",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#0C4A6E",
              marginBottom: "16px",
            }}
          >
            🔑 Test Account Credentials
          </h2>
          <p
            style={{ fontSize: "14px", color: "#334155", marginBottom: "16px" }}
          >
            For testing the mobile application, please use the following
            dedicated test account that{" "}
            <strong>
              bypasses all SMS, WhatsApp, and verification code requirements
            </strong>
            :
          </p>
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "6px",
              padding: "16px",
              fontFamily: "monospace",
              fontSize: "15px",
            }}
          >
            <p style={{ margin: "4px 0" }}>
              <strong>Phone Number:</strong> +961 1 234 567
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Verification Code:</strong> 123456
            </p>
          </div>
        </div>

        {/* Sign-In Process */}
        <div style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "16px",
            }}
          >
            📱 Sign-In Process
          </h2>
          <ol
            style={{
              fontSize: "15px",
              color: "#4B5563",
              lineHeight: "1.8",
              paddingLeft: "24px",
            }}
          >
            <li>Open the mobile app</li>
            <li>
              On the sign-in screen, select your country code:{" "}
              <strong>+961</strong> (Lebanon)
            </li>
            <li>
              Enter the phone number: <strong>1 234 567</strong>
            </li>
            <li>
              Tap <strong>"Send Verification Code"</strong>
            </li>
            <li>
              Enter the verification code: <strong>123456</strong>
            </li>
            <li>
              Tap <strong>"Verify & Sign In"</strong>
            </li>
          </ol>
          <p
            style={{
              fontSize: "14px",
              color: "#059669",
              marginTop: "12px",
              fontWeight: "500",
            }}
          >
            ✓ You will be instantly authenticated without waiting for any SMS or
            WhatsApp messages.
          </p>
        </div>

        {/* Important Notes */}
        <div
          style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#166534",
              marginBottom: "16px",
            }}
          >
            ✅ Important Notes
          </h2>
          <ul
            style={{
              fontSize: "14px",
              color: "#14532D",
              lineHeight: "1.8",
              paddingLeft: "24px",
              margin: 0,
            }}
          >
            <li>
              <strong>No real SMS/WhatsApp required</strong>: The test account
              completely bypasses all external messaging services
            </li>
            <li>
              <strong>Fixed verification code</strong>: The code{" "}
              <code
                style={{
                  backgroundColor: "#fff",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                123456
              </code>{" "}
              is hardcoded and never expires
            </li>
            <li>
              <strong>Pre-populated data</strong>: The test account includes
              sample data (loyalty points, order history) to demonstrate full
              app functionality
            </li>
            <li>
              <strong>24-hour validity</strong>: The verification code has a
              24-hour expiration for the review period
            </li>
            <li>
              <strong>Instant verification</strong>: No waiting time required -
              sign-in is immediate
            </li>
          </ul>
        </div>

        {/* Alternative Flow */}
        <div style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "16px",
            }}
          >
            🔄 Alternative Testing Flow (New Account)
          </h2>
          <p
            style={{ fontSize: "14px", color: "#6B7280", marginBottom: "12px" }}
          >
            If you need to test the sign-up flow instead of sign-in:
          </p>
          <ol
            style={{
              fontSize: "14px",
              color: "#4B5563",
              lineHeight: "1.8",
              paddingLeft: "24px",
            }}
          >
            <li>
              On the sign-up screen, enter the same phone number:{" "}
              <strong>+961 1 234 567</strong>
            </li>
            <li>
              When prompted, enter the verification code:{" "}
              <strong>123456</strong>
            </li>
            <li>
              Complete the profile with any test information:
              <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
                <li>First Name: (any name)</li>
                <li>Last Name: (any name)</li>
                <li>Birthday: (any date, must be 13+ years old)</li>
              </ul>
            </li>
          </ol>
          <p
            style={{
              fontSize: "13px",
              color: "#9CA3AF",
              marginTop: "12px",
              fontStyle: "italic",
            }}
          >
            However, for the quickest review experience, we recommend using the{" "}
            <strong>sign-in flow</strong> as described above, since the test
            account is already pre-configured.
          </p>
        </div>

        {/* Technical Implementation */}
        <div
          style={{
            backgroundColor: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "16px",
            }}
          >
            ⚙️ Technical Implementation
          </h2>
          <p
            style={{ fontSize: "14px", color: "#6B7280", marginBottom: "12px" }}
          >
            The test account bypasses:
          </p>
          <ul
            style={{
              fontSize: "14px",
              color: "#4B5563",
              lineHeight: "1.8",
              paddingLeft: "24px",
            }}
          >
            <li>Bird SMS/WhatsApp API calls</li>
            <li>Real-time verification code generation</li>
            <li>Network-dependent authentication flows</li>
            <li>Time-based code expiration (for review purposes)</li>
          </ul>
          <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "12px" }}>
            This ensures Apple reviewers can fully test the application without
            any dependencies on external services or network conditions.
          </p>
        </div>

        {/* Initialization Instructions */}
        <div
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #FCD34D",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#92400E",
              marginBottom: "16px",
            }}
          >
            🚀 Initializing the Test Account
          </h2>
          <p
            style={{ fontSize: "14px", color: "#78350F", marginBottom: "12px" }}
          >
            Before submitting to Apple, visit the following page to ensure the
            test account is initialized:
          </p>
          <a
            href="/init-test-account"
            style={{
              display: "inline-block",
              backgroundColor: "#357AFF",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
              marginTop: "8px",
            }}
          >
            Initialize Test Account →
          </a>
          <p style={{ fontSize: "13px", color: "#92400E", marginTop: "12px" }}>
            Click "Initialize Test Account" on that page to create the
            pre-configured test user in the database.
          </p>
        </div>

        {/* Support */}
        <div
          style={{
            paddingTop: "24px",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "12px",
            }}
          >
            💬 Support
          </h2>
          <p style={{ fontSize: "14px", color: "#6B7280" }}>
            If you encounter any issues during the review process, please
            contact us through App Store Connect, and we'll respond immediately.
          </p>
        </div>

        {/* Quick Reference Card */}
        <div
          style={{
            marginTop: "32px",
            backgroundColor: "#1F2937",
            color: "#fff",
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "16px",
              color: "#F9FAFB",
            }}
          >
            📋 Quick Reference Card
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              fontSize: "14px",
            }}
          >
            <div>
              <p
                style={{
                  color: "#9CA3AF",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Phone Number
              </p>
              <p style={{ fontFamily: "monospace", fontSize: "15px" }}>
                +961 1 234 567
              </p>
            </div>
            <div>
              <p
                style={{
                  color: "#9CA3AF",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Verification Code
              </p>
              <p style={{ fontFamily: "monospace", fontSize: "15px" }}>
                123456
              </p>
            </div>
            <div>
              <p
                style={{
                  color: "#9CA3AF",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Code Validity
              </p>
              <p style={{ fontSize: "15px" }}>Never expires</p>
            </div>
            <div>
              <p
                style={{
                  color: "#9CA3AF",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                SMS Required
              </p>
              <p style={{ fontSize: "15px" }}>No</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
