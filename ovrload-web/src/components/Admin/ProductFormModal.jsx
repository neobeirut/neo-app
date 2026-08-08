import { useEffect } from "react";
import { X } from "lucide-react";
import { ProductForm } from "./ProductForm";

export function ProductFormModal({
  isOpen,
  editingItem,
  categories,
  products,
  onSave,
  onClose,
}) {
  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    // Only close if clicking the overlay itself, not its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 animate-fadeIn"
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: "auto",
      }}
    >
      {/* Centering wrapper with padding for scroll */}
      <div className="min-h-full w-full flex items-center justify-center py-8">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-4xl animate-slideUp relative"
          style={{ maxHeight: "calc(100vh - 4rem)" }}
        >
          {/* Modal Header - Fixed */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white rounded-t-lg">
            <h2 className="text-xl font-bold text-gray-900">
              {editingItem ? "Edit Product" : "Add New Product"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-2 hover:bg-gray-100"
              title="Close (Esc)"
            >
              <X size={24} />
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div
            className="overflow-y-auto px-6 py-6"
            style={{ maxHeight: "calc(100vh - 12rem)" }}
          >
            <ProductForm
              editingItem={editingItem}
              categories={categories}
              products={products}
              onSave={onSave}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>

      {/* Add simple CSS animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
