"use client";

import { useState } from "react";

/**
 * WhatsApp Forensic Comparison Tool
 *
 * Side-by-side comparison of successful vs failed WhatsApp sends
 * Shows complete diagnostic data for troubleshooting
 */
export default function WhatsAppForensicComparisonPage() {
  const [phone, setPhone] = useState("");
  const [successStatus, setSuccessStatus] = useState("completed");
  const [failureStatus, setFailureStatus] = useState("ready_pickup");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/whatsapp-forensic-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          successStatus,
          failureStatus,
          orderId: orderId ? parseInt(orderId) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "1400px",
        margin: "0 auto",
        fontFamily: "monospace",
      }}
    >
      <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
        🔬 WhatsApp Forensic Comparison
      </h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        Compare successful vs failed WhatsApp sends side-by-side
      </p>

      {/* Input Form */}
      <div
        style={{
          background: "#f5f5f5",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "30px",
        }}
      >
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            Phone Number (with country code):
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1234567890"
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "14px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Success Status:
            </label>
            <select
              value={successStatus}
              onChange={(e) => setSuccessStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready_pickup">Ready (Pickup)</option>
              <option value="ready_delivery">Ready (Delivery)</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Failure Status:
            </label>
            <select
              value={failureStatus}
              onChange={(e) => setFailureStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready_pickup">Ready (Pickup)</option>
              <option value="ready_delivery">Ready (Delivery)</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Order ID (optional):
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="123"
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>

        <button
          onClick={runComparison}
          disabled={loading || !phone}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            background: loading || !phone ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading || !phone ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Running Comparison..." : "Run Forensic Comparison"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            background: "#fee",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px",
            border: "2px solid #c00",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#c00" }}>❌ Error</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "12px",
            }}
          >
            {error}
          </pre>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div>
          {/* Differences Summary */}
          <div
            style={{
              background: "#fffbf0",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "2px solid #ffa500",
            }}
          >
            <h2 style={{ marginTop: 0 }}>📊 Key Differences</h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Field
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Success
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Failure
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Different?
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.differences).map(([key, diff]) => (
                  <tr
                    key={key}
                    style={{ background: diff.different ? "#ffe0e0" : "white" }}
                  >
                    <td
                      style={{
                        padding: "8px",
                        border: "1px solid #ddd",
                        fontWeight: "bold",
                      }}
                    >
                      {key}
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      <pre style={{ margin: 0, fontSize: "12px" }}>
                        {JSON.stringify(diff.success, null, 2)}
                      </pre>
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      <pre style={{ margin: 0, fontSize: "12px" }}>
                        {JSON.stringify(diff.failure, null, 2)}
                      </pre>
                    </td>
                    <td
                      style={{
                        padding: "8px",
                        border: "1px solid #ddd",
                        textAlign: "center",
                      }}
                    >
                      {diff.different ? "⚠️ YES" : "✅ No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Side-by-Side Comparison */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            {/* Success Column */}
            <div>
              <h2
                style={{
                  background: "#d4edda",
                  padding: "10px",
                  borderRadius: "4px",
                  margin: 0,
                }}
              >
                🟢 Success: {result.success.status}
              </h2>
              <ForensicDataDisplay data={result.success} />
            </div>

            {/* Failure Column */}
            <div>
              <h2
                style={{
                  background: "#f8d7da",
                  padding: "10px",
                  borderRadius: "4px",
                  margin: 0,
                }}
              >
                🔴 Failure: {result.failure.status}
              </h2>
              <ForensicDataDisplay data={result.failure} />
            </div>
          </div>

          {/* DB Template Settings */}
          <div
            style={{
              marginTop: "30px",
              background: "#e8f4f8",
              padding: "20px",
              borderRadius: "8px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>💾 Database Template Settings</h2>
            <pre
              style={{
                background: "white",
                padding: "15px",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "12px",
              }}
            >
              {JSON.stringify(result.dbTemplateSettings, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ForensicDataDisplay({ data }) {
  if (data.error) {
    return (
      <div
        style={{
          background: "#fee",
          padding: "15px",
          borderRadius: "4px",
          marginTop: "10px",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#c00" }}>❌ Error</h3>
        <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>
          {data.error.message}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "10px" }}>
      {/* Summary */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "15px",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>📋 Summary</h3>
        <table style={{ width: "100%", fontSize: "12px" }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                Template Name:
              </td>
              <td>{data.templateName}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                Language:
              </td>
              <td>{data.language}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                🔒 Payload Sender:
              </td>
              <td>
                <code
                  style={{
                    background:
                      data.sender === "96176489078" ? "#d4edda" : "#f8d7da",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontWeight: "bold",
                  }}
                >
                  {data.sender || "N/A"}
                </code>
                {data.sender && data.sender !== "96176489078" && (
                  <span style={{ color: "#c00", marginLeft: "8px" }}>
                    ⚠️ WRONG (causes error 375)
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                🔍 Actual Sender Sent:
              </td>
              <td>
                <code
                  style={{
                    background:
                      data.actualSenderSent === "96176489078"
                        ? "#d4edda"
                        : "#f8d7da",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontWeight: "bold",
                  }}
                >
                  {data.actualSenderSent || "N/A"}
                </code>
                {data.actualSenderSent &&
                  data.actualSenderSent !== "96176489078" && (
                    <span style={{ color: "#c00", marginLeft: "8px" }}>
                      ⚠️ WRONG (causes error 375)
                    </span>
                  )}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                Body Placeholders:
              </td>
              <td>
                <code>{JSON.stringify(data.bodyPlaceholders)}</code>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                Has Header:
              </td>
              <td>{data.hasHeader ? "✅ Yes" : "❌ No"}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                Has Media:
              </td>
              <td>{data.hasMedia ? "✅ Yes" : "❌ No"}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                HTTP Status:
              </td>
              <td
                style={{
                  fontWeight: "bold",
                  color: data.httpStatus === 200 ? "green" : "red",
                }}
              >
                {data.httpStatus}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", padding: "4px 0" }}>
                X-Request-ID:
              </td>
              <td>
                <code style={{ fontSize: "10px" }}>
                  {data.xRequestId || "N/A"}
                </code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Request Body */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "15px",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>📤 Request Body (Sent to Infobip)</h3>
        <pre
          style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "11px",
            maxHeight: "300px",
          }}
        >
          {data.finalRequestBodyString || "N/A"}
        </pre>
        <p style={{ fontSize: "12px", color: "#666", marginBottom: 0 }}>
          Size: {data.finalRequestBodyString?.length || 0} bytes
        </p>
      </div>

      {/* Response Body */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "15px",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>📥 Response Body (From Infobip)</h3>
        <pre
          style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "11px",
            maxHeight: "300px",
          }}
        >
          {JSON.stringify(data.rawInfobipResponse, null, 2) || "N/A"}
        </pre>
      </div>

      {/* Template Data */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "15px",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🔧 Template Data (Built by Registry)</h3>
        <pre
          style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "11px",
            maxHeight: "300px",
          }}
        >
          {JSON.stringify(data.templateData, null, 2)}
        </pre>
      </div>

      {/* Full Payload */}
      <details
        style={{ background: "#f8f9fa", padding: "15px", borderRadius: "4px" }}
      >
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
          📦 Full Payload (Click to expand)
        </summary>
        <pre
          style={{
            background: "white",
            padding: "10px",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "11px",
            marginTop: "10px",
            maxHeight: "400px",
          }}
        >
          {JSON.stringify(data.fullPayload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
