import { useState } from "react";

export function CategoryForm({ editingItem, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: editingItem?.name || "",
    image_url: editingItem?.image_url || "",
    display_order: editingItem?.display_order || 0,
    section: editingItem?.section || "Store",
    is_active: editingItem?.is_active ?? true,
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
        {editingItem ? "Edit Category" : "Add New Category"}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Category Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />
        <select
          value={formData.section}
          onChange={(e) =>
            setFormData({ ...formData, section: e.target.value })
          }
          className="border rounded px-3 py-2 text-gray-900"
        >
          <option value="Store">Store</option>
          <option value="Bistro">Bistro</option>
        </select>
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
          placeholder="Display Order"
          value={formData.display_order}
          onChange={(e) =>
            setFormData({
              ...formData,
              display_order: parseInt(e.target.value),
            })
          }
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />
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
