import { TEMPLATE_STATUSES } from "./constants";

export function WhatsAppTemplatesSection({
  waTemplates,
  setWaTemplates,
  waTemplateLoading,
  waTemplateSaving,
  waTemplateUpdatedAt,
  waTestLoading,
  handleSaveWhatsAppTemplates,
  handleTestBirdConfig,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-4xl mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        WhatsApp Order Templates
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Configure WhatsApp templates for each order status. Template
        configuration works with both Bird and Infobip providers.
      </p>

      {waTemplateLoading ? (
        <div className="text-gray-600">Loading WhatsApp templates…</div>
      ) : (
        <form onSubmit={handleSaveWhatsAppTemplates} className="space-y-6">
          {/* New Order to Branch Template - Special Section */}
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                BRANCH NOTIFICATION
              </span>
              New Order Alert to Branch
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              This template is sent to the branch's WhatsApp when a customer
              places a new order.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  value={waTemplates.new_order_to_branch?.template_name || ""}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      new_order_to_branch: {
                        ...prev.new_order_to_branch,
                        template_name: e.target.value,
                      },
                    }))
                  }
                  placeholder="new_order_notification"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project ID
                </label>
                <input
                  value={waTemplates.new_order_to_branch?.projectId || ""}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      new_order_to_branch: {
                        ...prev.new_order_to_branch,
                        projectId: e.target.value,
                      },
                    }))
                  }
                  placeholder="97fd54f9-19c0-42ca-a0eb-c78839fd9133"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Published Version ID
                </label>
                <input
                  value={waTemplates.new_order_to_branch?.version_id || ""}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      new_order_to_branch: {
                        ...prev.new_order_to_branch,
                        version_id: e.target.value,
                      },
                    }))
                  }
                  placeholder="43ca1194-c886-4aa0-af0b-7219fb139436"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version (optional)
                </label>
                <input
                  value={waTemplates.new_order_to_branch?.version || "latest"}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      new_order_to_branch: {
                        ...prev.new_order_to_branch,
                        version: e.target.value,
                      },
                    }))
                  }
                  placeholder="latest"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locale (optional)
                </label>
                <input
                  value={waTemplates.new_order_to_branch?.locale || "en"}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      new_order_to_branch: {
                        ...prev.new_order_to_branch,
                        locale: e.target.value,
                      },
                    }))
                  }
                  placeholder="en"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Delivery to Branch Template - Special Section */}
          <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">
                BRANCH NOTIFICATION
              </span>
              Delivery Order Alert to Branch
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              Sent to the branch's WhatsApp when an admin manually triggers a
              delivery notification. Uses Infobip template{" "}
              <code className="bg-orange-100 px-1 rounded text-xs">
                delivery_to_branch
              </code>
              .
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  value={waTemplates.delivery_to_branch?.template_name || ""}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      delivery_to_branch: {
                        ...prev.delivery_to_branch,
                        template_name: e.target.value,
                      },
                    }))
                  }
                  placeholder="delivery_to_branch"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Exact template name as approved in Infobip
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <input
                  value={waTemplates.delivery_to_branch?.language || "en"}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      delivery_to_branch: {
                        ...prev.delivery_to_branch,
                        language: e.target.value,
                      },
                    }))
                  }
                  placeholder="en"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="mt-3 bg-orange-100 rounded p-3 text-xs text-orange-900 space-y-1">
              <p className="font-semibold">
                Template body example (1 placeholder):
              </p>
              <p className="font-mono">
                New delivery order #{"{{"}"1{"}}"} has been placed. Check the
                admin panel for full details.
              </p>
              <p className="mt-2 font-semibold">
                Schema: 1 body placeholder (order ID), no header, no buttons.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-medium text-gray-900 mb-3">
              Customer Order Status Templates
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              These templates are sent to customers when their order status
              changes.
            </p>
          </div>

          {TEMPLATE_STATUSES.map((status) => (
            <div
              key={status.key}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <h4 className="font-medium text-gray-900 mb-3">{status.label}</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <input
                    value={waTemplates[status.key]?.template_name || ""}
                    onChange={(e) =>
                      setWaTemplates((prev) => ({
                        ...prev,
                        [status.key]: {
                          ...prev[status.key],
                          template_name: e.target.value,
                        },
                      }))
                    }
                    placeholder={`order_${status.key}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project ID
                  </label>
                  <input
                    value={waTemplates[status.key]?.project_id || ""}
                    onChange={(e) =>
                      setWaTemplates((prev) => ({
                        ...prev,
                        [status.key]: {
                          ...prev[status.key],
                          project_id: e.target.value,
                        },
                      }))
                    }
                    placeholder="97fd54f9-19c0-42ca-a0eb-c78839fd9133"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Published Version ID
                  </label>
                  <input
                    value={waTemplates[status.key]?.version_id || ""}
                    onChange={(e) =>
                      setWaTemplates((prev) => ({
                        ...prev,
                        [status.key]: {
                          ...prev[status.key],
                          version_id: e.target.value,
                        },
                      }))
                    }
                    placeholder="43ca1194-c886-4aa0-af0b-7219fb139436"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          ))}

          {waTemplateUpdatedAt ? (
            <p className="text-xs text-gray-400">
              Last updated: {new Date(waTemplateUpdatedAt).toLocaleString()}
            </p>
          ) : null}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">
              How to find these values in Bird:
            </p>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to Bird → Message Templates</li>
              <li>Click on your template (e.g., "order_completed")</li>
              <li>
                Copy the <strong>Project ID</strong> from the Overview tab
              </li>
              <li>
                Copy the <strong>Published version ID</strong> from the Overview
                tab
              </li>
              <li>Paste them here for each status template</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={waTemplateSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {waTemplateSaving ? "Saving…" : "Save All Templates"}
            </button>

            <button
              type="button"
              onClick={handleTestBirdConfig}
              disabled={waTestLoading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {waTestLoading ? "Testing…" : "Test Connection"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
