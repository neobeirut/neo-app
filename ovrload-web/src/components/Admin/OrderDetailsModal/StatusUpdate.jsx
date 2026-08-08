import { Save } from "lucide-react";
import { statusOptions } from "./constants";

export function StatusUpdate({
  status,
  originalStatus,
  isStatusLocked,
  onStatusChange,
  onUpdateStatus,
}) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Order Status
      </label>
      {isStatusLocked ? (
        <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-medium text-gray-900">Final Status</p>
            <p className="text-sm text-gray-600">
              Completed or cancelled orders cannot be moved to another status.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {status !== originalStatus && (
            <button
              onClick={onUpdateStatus}
              className="bg-blue-500 text-white px-4 py-1 rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Save size={18} />
              Update Status
            </button>
          )}
        </div>
      )}
    </div>
  );
}
