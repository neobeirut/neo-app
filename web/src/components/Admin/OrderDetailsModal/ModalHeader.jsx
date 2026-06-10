import { X, MessageCircle } from "lucide-react";

export function ModalHeader({ orderId, onClose, onOpenWhatsApp }) {
  return (
    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Order #{orderId}</h2>
        <button
          onClick={onOpenWhatsApp}
          className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          title="Send WhatsApp for Delivery"
        >
          <MessageCircle size={18} />
          Send WhatsApp for Delivery
        </button>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <X size={24} />
      </button>
    </div>
  );
}
