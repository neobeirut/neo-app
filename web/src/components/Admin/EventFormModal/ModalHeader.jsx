import { X } from "lucide-react";

export function ModalHeader({ editingItem, onClose }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b">
      <div>
        <div className="text-lg font-semibold text-gray-900">
          {editingItem ? "Edit Event" : "Create Event"}
        </div>
        <div className="text-sm text-gray-500">
          Upcoming + past recap are managed in one place.
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 rounded hover:bg-gray-100"
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>
  );
}
