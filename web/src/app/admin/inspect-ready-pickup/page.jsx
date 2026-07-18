"use client";

import { useState, useEffect } from "react";

export default function InspectReadyPickupPage() {
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInspection();
  }, []);

  const loadInspection = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/inspect-ready-pickup-template");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInspection(data);
    } catch (err) {
      console.error("Inspection failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="text-xl">Loading inspection...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">
              Inspection Failed
            </h2>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { database, codeStructure, potentialIssues, error7008Guidance } =
    inspection || {};

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-2">
            🔍 Ready Pickup Template Inspector
          </h1>
          <p className="text-gray-600">
            Diagnostic tool to compare database config vs code structure vs
            Infobip approved template
          </p>
        </div>

        {/* Potential Issues */}
        {potentialIssues && potentialIssues.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-4">
              ⚠️ Potential Issues ({potentialIssues.length})
            </h2>
            <div className="space-y-3">
              {potentialIssues.map((issue, idx) => (
                <div key={idx} className="bg-white rounded p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-red-600 font-bold">
                      {issue.severity}:
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{issue.issue}</p>
                      <p className="text-sm text-green-700 mt-1">
                        ✓ Fix: {issue.fix}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Database Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            📊 Database Configuration (app_settings)
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Exists in DB:</div>
                <div
                  className={`font-mono text-lg ${database?.exists ? "text-green-600" : "text-red-600"}`}
                >
                  {database?.exists ? "✓ YES" : "✗ NO"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Last Updated:</div>
                <div className="font-mono">
                  {database?.updatedAt
                    ? new Date(database.updatedAt).toLocaleString()
                    : "N/A"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">Template Name:</div>
              <div className="font-mono text-lg font-bold bg-yellow-50 p-3 rounded border border-yellow-200">
                {database?.templateName || "❌ NOT CONFIGURED"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                This is the template name in Infobip (should match exactly)
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">Language:</div>
              <div className="font-mono text-lg bg-blue-50 p-3 rounded border border-blue-200">
                {database?.language || "❌ NOT CONFIGURED"}
              </div>
            </div>

            {database?.rawValue && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Raw JSON Config
                </summary>
                <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {database.rawValue}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* Code Structure */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            💻 Code Structure (whatsappTemplateRegistry.js)
          </h2>
          {codeStructure ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Category:</div>
                  <div className="font-mono text-lg">
                    {codeStructure.category}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Has Body:</div>
                  <div
                    className={`font-mono text-lg ${codeStructure.hasBody ? "text-green-600" : "text-gray-400"}`}
                  >
                    {codeStructure.hasBody ? "✓ YES" : "✗ NO"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">
                    Body Placeholder Count:
                  </div>
                  <div className="font-mono text-2xl font-bold bg-purple-50 p-3 rounded border border-purple-200">
                    {codeStructure.bodyPlaceholderCount}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">
                    Has Header (MEDIA):
                  </div>
                  <div
                    className={`font-mono text-2xl font-bold p-3 rounded border ${codeStructure.hasHeader ? "bg-green-50 border-green-200 text-green-600" : "bg-gray-50 border-gray-200 text-gray-600"}`}
                  >
                    {codeStructure.hasHeader ? "✓ YES" : "✗ NO"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Has Buttons:</div>
                  <div
                    className={`font-mono text-lg ${codeStructure.hasButtons ? "text-green-600" : "text-gray-400"}`}
                  >
                    {codeStructure.hasButtons ? "✓ YES" : "✗ NO"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Has Footer:</div>
                  <div
                    className={`font-mono text-lg ${codeStructure.hasFooter ? "text-green-600" : "text-gray-400"}`}
                  >
                    {codeStructure.hasFooter ? "✓ YES" : "✗ NO"}
                  </div>
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Full Structure Object
                </summary>
                <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(codeStructure, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700 font-medium">
                ❌ Code structure not defined for ready_pickup
              </p>
            </div>
          )}
        </div>

        {/* Error 7008 Guidance */}
        {error7008Guidance && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-orange-800 mb-4">
              🚨 Error 7008: Failed to match template parameters
            </h2>

            <div className="mb-4">
              <h3 className="font-bold text-gray-900 mb-2">Common Causes:</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {error7008Guidance.commonCauses?.map((cause, idx) => (
                  <li key={idx}>{cause}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Debug Steps:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                {error7008Guidance.debugSteps?.map((step, idx) => (
                  <li key={idx} className="pl-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Infobip Inspection Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-800 mb-4">
            🔍 How to Check Actual Approved Template in Infobip
          </h2>

          <div className="space-y-4">
            <div className="bg-white rounded p-4">
              <div className="font-bold text-gray-900 mb-2">
                Step 1: Access Infobip
              </div>
              <p className="text-gray-700">
                Go to Infobip dashboard:{" "}
                <a
                  href="https://portal.infobip.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  https://portal.infobip.com
                </a>
              </p>
            </div>

            <div className="bg-white rounded p-4">
              <div className="font-bold text-gray-900 mb-2">
                Step 2: Navigate to Templates
              </div>
              <p className="text-gray-700">
                Solutions → Channels → WhatsApp → Message Templates
              </p>
            </div>

            <div className="bg-white rounded p-4">
              <div className="font-bold text-gray-900 mb-2">
                Step 3: Search for Template
              </div>
              <div className="font-mono text-lg bg-yellow-100 p-2 rounded border border-yellow-300 mb-2">
                Template Name: {database?.templateName || "ready_pickup"}
              </div>
              <p className="text-sm text-gray-600">
                Click on the template to view its full structure
              </p>
            </div>

            <div className="bg-white rounded p-4">
              <div className="font-bold text-gray-900 mb-2">
                Step 4: Check Template Structure
              </div>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>Does it have a HEADER? (image/video/document)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>
                    What is the BODY text? How many {`{{placeholders}}`} does it
                    have?
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>Does it have BUTTONS?</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>Does it have a FOOTER?</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>What is the LANGUAGE code?</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>What is the STATUS? (Approved/Pending/Rejected)</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded p-4">
              <div className="font-bold text-gray-900 mb-2">
                Step 5: Compare & Fix
              </div>
              <p className="text-gray-700">
                Compare what you see in Infobip to the "Code Structure" section
                above. If they don't match, you need to update the code
                structure in{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  whatsappTemplateRegistry.js
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🛠️ Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() =>
                (window.location.href = "/admin/whatsapp-forensic-comparison")
              }
              className="w-full bg-blue-600 text-white px-6 py-3 rounded font-medium hover:bg-blue-700"
            >
              → Run Forensic Comparison Test
            </button>
            <button
              onClick={loadInspection}
              className="w-full bg-gray-600 text-white px-6 py-3 rounded font-medium hover:bg-gray-700"
            >
              🔄 Refresh Inspection
            </button>
            <button
              onClick={() => (window.location.href = "/admin")}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded font-medium hover:bg-gray-300"
            >
              ← Back to Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
