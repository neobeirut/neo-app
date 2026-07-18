import { TEMPLATE_STATUSES } from "./constants";

export function WhatsAppTemplatesSection({
  waTemplates,
  setWaTemplates,
  waTemplateLoading,
  waTemplateSaving,
  waTemplateUpdatedAt,
  handleSaveWhatsAppTemplates,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-4xl mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        WhatsApp Order Templates
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Configure WhatsApp templates for each order status. Infobip templates require a valid template name and language/locale.
      </p>

      {waTemplateLoading ? (
        <div className="text-gray-600">Loading WhatsApp templates...</div>
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
                  Language / Locale
                </label>
                <input
                  value={waTemplates.new_order_to_branch?.language || waTemplates.new_order_to_branch?.locale || "en_US"}
                  onChange={(e) =>
                    setWaTemplates((prev) => ({
                      ...prev,
                      new_order_to_branch: {
                        ...prev.new_order_to_branch,
                        language: e.target.value,
                        locale: e.target.value, // keep for backward compatibility
                      },
                    }))
                  }
                  placeholder="en_US"
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
                New delivery order details: #{"{"}1{"}"}
              </p>
              <p className="mt-2 font-semibold">
                Schema: 1 body placeholder (contains consolidated order details on a single line), no header, no buttons.
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
                    Language
                  </label>
                  <input
                    value={waTemplates[status.key]?.language || waTemplates[status.key]?.locale || "en_US"}
                    onChange={(e) =>
                      setWaTemplates((prev) => ({
                        ...prev,
                        [status.key]: {
                          ...prev[status.key],
                          language: e.target.value,
                          locale: e.target.value, // keep for backward compatibility
                        },
                      }))
                    }
                    placeholder="en_US"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={waTemplateSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {waTemplateSaving ? "Saving..." : "Save All Templates"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
