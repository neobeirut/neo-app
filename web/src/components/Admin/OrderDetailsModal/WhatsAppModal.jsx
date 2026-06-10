import { X, Loader2 } from "lucide-react";

export function WhatsAppModal({
  waOpen,
  waPreview,
  waLoading,
  waSending,
  waCanSend,
  waReason,
  waForceNext,
  onClose,
  onRefresh,
  onSend,
}) {
  if (!waOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Send WhatsApp for Delivery
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Preview the exact message before sending.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={waSending}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {waLoading ? (
            <div className="flex items-center gap-2 text-gray-700">
              <Loader2 className="animate-spin" size={18} />
              Loading preview...
            </div>
          ) : null}

          {waReason ? (
            <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
              {waReason}
            </div>
          ) : null}

          <textarea
            value={waPreview}
            readOnly
            className="w-full border rounded-lg p-3 text-sm font-mono h-64"
          />

          {waForceNext ? (
            <div className="mt-3 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-sm">
              WhatsApp was already sent recently for this order. If you tap Send
              again, it will send one more time.
            </div>
          ) : null}

          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={onRefresh}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={waLoading || waSending}
            >
              Refresh
            </button>
            <button
              onClick={onSend}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              disabled={waLoading || waSending || !waCanSend}
            >
              {waSending ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
