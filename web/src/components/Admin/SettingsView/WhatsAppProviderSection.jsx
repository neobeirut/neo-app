import { useState, useEffect } from "react";
import { getAdminHeaders } from "@/utils/adminAuth";

export function WhatsAppProviderSection() {
  const [provider, setProvider] = useState("bird");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingBird, setTestingBird] = useState(false);
  const [testingInfobip, setTestingInfobip] = useState(false);
  const [configuringInfobip, setConfiguringInfobip] = useState(false);
  const [configResult, setConfigResult] = useState(null);
  const [infobipConfig, setInfobipConfig] = useState({
    baseUrl: null,
    sender: null,
  });
  const [birdConfig, setBirdConfig] = useState({
    workspaceId: null,
    channelId: null,
  });

  useEffect(() => {
    loadProvider();
  }, []);

  const loadProvider = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/whatsapp-provider", {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider || "bird");
      }
    } catch (error) {
      console.error("Failed to load WhatsApp provider", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProvider = async (newProvider) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/whatsapp-provider", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ provider: newProvider }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save provider");
      }

      setProvider(newProvider);
      alert(
        `✅ WhatsApp provider successfully set to ${newProvider.toUpperCase()}`,
      );
    } catch (error) {
      console.error("Failed to save provider", error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConfigureInfobipTemplates = async () => {
    if (
      !confirm(
        "Configure Infobip templates?\n\nThis will update your database to use Infobip format (template_name + language only).\n\nMake sure your templates are approved in Infobip portal first!",
      )
    ) {
      return;
    }

    setConfiguringInfobip(true);
    setConfigResult(null);

    try {
      const response = await fetch("/api/admin/configure-infobip-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          templates: {
            pending: "pending",
            preparing: "preparing",
            ready_pickup: "ready_pickup",
            ready_delivery: "ready_delivery",
            out_for_delivery: "out_for_delivery",
            completed: "completed",
            cancelled: "cancelled",
            new_order_to_branch: "new_order_to_branch",
          },
          language: "en_US",
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setConfigResult({
          success: true,
          message: data.message,
          results: data.results,
        });
        alert(
          `✅ ${data.message}\n\n${data.note}\n\nYou can now send WhatsApp messages via Infobip!`,
        );
      } else {
        setConfigResult({
          success: false,
          message: data.error || "Failed to configure templates",
        });
        alert(
          `❌ Failed to configure templates:\n\n${data.error || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error("Configure error:", error);
      setConfigResult({
        success: false,
        message: error.message,
      });
      alert(`❌ Error:\n\n${error.message}`);
    } finally {
      setConfiguringInfobip(false);
    }
  };

  const handleTestBird = async () => {
    setTestingBird(true);
    try {
      const response = await fetch("/api/admin/test-bird-config", {
        headers: getAdminHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (data?.configured) {
        // Store Bird config values
        setBirdConfig({
          workspaceId: data.workspaceId,
          channelId: data.channelId,
        });

        let message = `✅ ${data.message}\n\n`;
        message += `🔧 Bird API Configuration:\n`;
        message += `  • Workspace ID: ${data.workspaceId}\n`;
        message += `  • Channel ID: ${data.channelId}\n`;
        message += `  • Locale: ${data.locale}\n\n`;

        if (data.templates) {
          message += `📝 Templates: ${data.templates.count} configured\n`;
          if (data.templates.issues && data.templates.issues.length > 0) {
            message += `\n⚠️ Template Issues:\n`;
            data.templates.issues.forEach((issue) => {
              message += `  • ${issue}\n`;
            });
          } else {
            message += `  ✅ All templates validated!\n`;
          }
          message += `\n`;
        }

        if (data.branches) {
          message += `🏢 Branches:\n`;
          message += `  • Total: ${data.branches.total}\n`;
          message += `  • With phone: ${data.branches.withPhone}\n`;
          if (data.branches.withoutPhone > 0) {
            message += `  ⚠️ Without phone: ${data.branches.withoutPhone}\n`;
            if (
              data.branches.missingPhone &&
              data.branches.missingPhone.length > 0
            ) {
              message += `     Missing: ${data.branches.missingPhone.join(", ")}\n`;
            }
          }
        }

        alert(message);
      } else {
        const errorMsg = data?.error || `Test failed (HTTP ${response.status})`;
        const hint = data?.hint ? `\n\n💡 Hint:\n${data.hint}` : "";
        const step = data?.step ? `\n\nFailed at: ${data.step}` : "";
        alert(`❌ Bird Configuration Test Failed\n\n${errorMsg}${step}${hint}`);
      }
    } catch (error) {
      console.error("Error testing Bird config:", error);
      alert(`❌ Failed to test Bird configuration:\n\n${error.message}`);
    } finally {
      setTestingBird(false);
    }
  };

  const handleTestInfobip = async () => {
    setTestingInfobip(true);
    try {
      const response = await fetch("/api/admin/test-infobip-config", {
        headers: getAdminHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (data?.configured) {
        // Store Infobip config values
        setInfobipConfig({
          baseUrl: data.baseUrl,
          sender: data.sender,
        });

        let message = `✅ ${data.message}\n\n`;
        message += `🔧 Infobip API Configuration:\n`;
        message += `  • Base URL: ${data.baseUrl}\n`;
        message += `  • Sender: ${data.sender}\n\n`;

        if (data.templates) {
          message += `📝 Templates: ${data.templates.count} configured\n`;
          if (data.templates.issues && data.templates.issues.length > 0) {
            message += `\n⚠️ Template Issues:\n`;
            data.templates.issues.forEach((issue) => {
              message += `  • ${issue}\n`;
            });
          } else {
            message += `  ✅ All templates validated!\n`;
          }
          message += `\n`;
        }

        if (data.branches) {
          message += `🏢 Branches:\n`;
          message += `  • Total: ${data.branches.total}\n`;
          message += `  • With phone: ${data.branches.withPhone}\n`;
          if (data.branches.withoutPhone > 0) {
            message += `  ⚠️ Without phone: ${data.branches.withoutPhone}\n`;
            if (
              data.branches.missingPhone &&
              data.branches.missingPhone.length > 0
            ) {
              message += `     Missing: ${data.branches.missingPhone.join(", ")}\n`;
            }
          }
        }

        alert(message);
      } else {
        const errorMsg = data?.error || `Test failed (HTTP ${response.status})`;
        const hint = data?.hint ? `\n\n💡 Hint:\n${data.hint}` : "";
        const step = data?.step ? `\n\nFailed at: ${data.step}` : "";
        alert(
          `❌ Infobip Configuration Test Failed\n\n${errorMsg}${step}${hint}`,
        );
      }
    } catch (error) {
      console.error("Error testing Infobip config:", error);
      alert(`❌ Failed to test Infobip configuration:\n\n${error.message}`);
    } finally {
      setTestingInfobip(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 max-w-4xl mb-6">
        <div className="text-gray-600">Loading WhatsApp provider settings…</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-4xl mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        WhatsApp Provider
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Choose which WhatsApp provider to use for sending messages. Both Bird
        and Infobip can be configured simultaneously for easy migration and
        rollback.
      </p>

      <div className="space-y-4">
        {/* Bird Option */}
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            provider === "bird"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
          onClick={() => !saving && handleSaveProvider("bird")}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <input
                type="radio"
                checked={provider === "bird"}
                onChange={() => handleSaveProvider("bird")}
                disabled={saving}
                className="w-4 h-4"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">Bird</h4>
                {provider === "bird" && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Bird.com WhatsApp Business API integration
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  • Workspace ID:{" "}
                  {birdConfig.workspaceId ||
                    "(click 'Test Connection' to view)"}
                </div>
                <div>
                  • Channel ID:{" "}
                  {birdConfig.channelId || "(click 'Test Connection' to view)"}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestBird();
                }}
                disabled={testingBird}
                className="mt-3 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {testingBird ? "Testing…" : "Test Bird Connection"}
              </button>
            </div>
          </div>
        </div>

        {/* Infobip Option */}
        <div
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            provider === "infobip"
              ? "border-orange-500 bg-orange-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
          onClick={() => !saving && handleSaveProvider("infobip")}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <input
                type="radio"
                checked={provider === "infobip"}
                onChange={() => handleSaveProvider("infobip")}
                disabled={saving}
                className="w-4 h-4"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">Infobip</h4>
                {provider === "infobip" && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Infobip WhatsApp Business API integration
              </p>

              {provider === "infobip" && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <div className="font-medium mb-1">
                    🔧 Quick Setup Required:
                  </div>
                  <div>
                    1. Make sure templates are <strong>approved</strong> in
                    Infobip portal
                    <br />
                    2. Click "Auto-Configure Templates" below to update database
                    <br />
                    3. Templates will be ready for sending messages
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  • Base URL:{" "}
                  {infobipConfig.baseUrl || "(click 'Test Connection' to view)"}
                </div>
                <div>
                  • Sender:{" "}
                  {infobipConfig.sender || "(click 'Test Connection' to view)"}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestInfobip();
                }}
                disabled={testingInfobip}
                className="mt-3 px-4 py-1.5 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50"
              >
                {testingInfobip ? "Testing…" : "Test Infobip Connection"}
              </button>

              {provider === "infobip" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfigureInfobipTemplates();
                  }}
                  disabled={configuringInfobip}
                  className="ml-2 mt-3 px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {configuringInfobip
                    ? "Configuring…"
                    : "⚡ Auto-Configure Templates"}
                </button>
              )}

              {configResult && provider === "infobip" && (
                <div
                  className={`mt-3 p-3 rounded text-xs ${
                    configResult.success
                      ? "bg-green-100 border border-green-300 text-green-800"
                      : "bg-red-100 border border-red-300 text-red-800"
                  }`}
                >
                  <div className="font-medium mb-1">
                    {configResult.success ? "✅ Success" : "❌ Error"}
                  </div>
                  <div>{configResult.message}</div>
                  {configResult.results && (
                    <div className="mt-2 space-y-0.5">
                      {configResult.results.map((r, i) => (
                        <div key={i}>
                          • {r.key}: {r.templateName} ({r.status})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Migration Notice */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">
          🛡️ Safe Migration Strategy
        </h4>
        <ul className="text-xs text-yellow-800 space-y-1">
          <li>✅ Both Bird and Infobip credentials are kept active</li>
          <li>✅ Switch providers instantly with one click</li>
          <li>✅ Test each provider independently before switching</li>
          <li>✅ Roll back to Bird immediately if needed</li>
          <li>
            ⚠️ Only delete Bird credentials after 1-2 weeks of stable Infobip
            operation
          </li>
        </ul>
      </div>
    </div>
  );
}
