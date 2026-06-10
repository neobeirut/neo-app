import { Save, Plus } from "lucide-react";
import { OrderItem } from "./OrderItem";
import { ItemEditModal } from "./ItemEditModal";
import { AddItemModal } from "./AddItemModal";
import { useState } from "react";

export function OrderItemsList({
  items,
  isEditing,
  isContentLocked,
  branchId,
  onToggleEdit,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onAddItem,
  onSaveItems,
}) {
  const [editingItem, setEditingItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSaveEdit = (updatedItem) => {
    onEditItem(updatedItem);
    setEditingItem(null);
  };

  const handleAddItem = (newItem) => {
    onAddItem(newItem);
    setShowAddModal(false);
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Order Items</h3>
        <div className="flex items-center gap-3">
          {isEditing && !isContentLocked && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 text-green-600 hover:text-green-800 text-sm font-medium border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 transition-colors"
            >
              <Plus size={14} />
              Add Item
            </button>
          )}
          {!isContentLocked && (
            <button
              onClick={onToggleEdit}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {isEditing ? "Cancel Edit" : "Edit Items"}
            </button>
          )}
          {isContentLocked && (
            <p className="text-xs text-gray-500">🔒 Items locked</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <OrderItem
            key={item.id || item._tempId}
            item={item}
            isEditing={isEditing}
            isContentLocked={isContentLocked}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveItem={onRemoveItem}
            onEditItem={() => setEditingItem(item)}
          />
        ))}
      </div>

      {isEditing && !isContentLocked && (
        <button
          onClick={onSaveItems}
          className="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
        >
          <Save size={18} />
          Save Changes
        </button>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal
          branchId={branchId}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddItem}
        />
      )}
    </div>
  );
}
