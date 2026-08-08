import { useState } from "react";

export function RewardForm({ editingItem, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: editingItem?.title || "",
    description: editingItem?.description || "",
    points_cost: editingItem?.points_cost || "",
    image_url: editingItem?.image_url || "",
    is_active: editingItem?.is_active ?? true,
    discount_amount:
      editingItem?.discount_amount === null ||
      editingItem?.discount_amount === undefined
        ? ""
        : String(editingItem.discount_amount),
    free_delivery: editingItem?.free_delivery ?? false,
  });

  const handleSubmit = async () => {
    const dataToSave = editingItem
      ? { ...formData, id: editingItem.id }
      : formData;
    const success = await onSave(dataToSave);
    if (success) {
      onCancel();
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">
        {editingItem ? "Edit Reward" : "Add New Reward"}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Reward Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />
        <input
          type="number"
          placeholder="Points Cost"
          value={formData.points_cost}
          onChange={(e) =>
            setFormData({
              ...formData,
              points_cost: parseInt(e.target.value),
            })
          }
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />

        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="border rounded px-3 py-2 col-span-2 placeholder:text-gray-400"
          rows="3"
        />

        <input
          type="url"
          placeholder="Image URL"
          value={formData.image_url}
          onChange={(e) =>
            setFormData({ ...formData, image_url: e.target.value })
          }
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />

        <input
          type="number"
          step="0.01"
          placeholder="Discount Amount (e.g. 5.00)"
          value={formData.discount_amount}
          onChange={(e) =>
            setFormData({ ...formData, discount_amount: e.target.value })
          }
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.free_delivery}
            onChange={(e) =>
              setFormData({ ...formData, free_delivery: e.target.checked })
            }
          />
          Free Delivery
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) =>
              setFormData({ ...formData, is_active: e.target.checked })
            }
          />
          Active
        </label>

        <div className="col-span-2 text-xs text-gray-500">
          Note: For automatic checkout discounts, set either a Discount Amount
          or Free Delivery.
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSubmit}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
