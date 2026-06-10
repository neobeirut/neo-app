import { useState } from "react";

export function BranchForm({ editingItem, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: editingItem?.name || "",
    address: editingItem?.address || "",
    phone: editingItem?.phone || "",
    whatsapp_phone: editingItem?.whatsapp_phone || "",
    location: editingItem?.location || "",
    is_active: editingItem?.is_active ?? true,
    discount_percentage: editingItem?.discount_percentage || 0,
    image_url: editingItem?.image_url || "",
    delivery_radius_km:
      editingItem?.delivery_radius_km === null ||
      editingItem?.delivery_radius_km === undefined
        ? 10
        : Number(editingItem.delivery_radius_km),
    opening_time: editingItem?.opening_time || "09:00",
    closing_time: editingItem?.closing_time || "21:00",
    delivery_start_time: editingItem?.delivery_start_time || "11:00",
    delivery_end_time: editingItem?.delivery_end_time || "20:00",
    orders_active: editingItem?.orders_active ?? true,
  });

  const [imageError, setImageError] = useState(null);

  const validateImageUrl = (url) => {
    if (!url.trim()) {
      setImageError(null);
      return true;
    }

    try {
      new URL(url);
      setImageError(null);
      return true;
    } catch (e) {
      setImageError("Please enter a valid URL");
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Branch name is required");
      return;
    }

    const radiusValue = Number(formData.delivery_radius_km);
    const radiusOk = Number.isFinite(radiusValue) && radiusValue >= 0;

    if (!radiusOk) {
      alert("Delivery radius must be a non-negative number");
      return;
    }

    if (formData.image_url && !validateImageUrl(formData.image_url)) {
      alert("Please enter a valid image URL");
      return;
    }

    // Validate time windows
    if (formData.opening_time >= formData.closing_time) {
      alert("Closing time must be after opening time");
      return;
    }

    if (formData.delivery_start_time >= formData.delivery_end_time) {
      alert("Delivery end time must be after delivery start time");
      return;
    }

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
        {editingItem ? "Edit Branch" : "Add New Branch"}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Branch Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />
        <input
          type="text"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="border rounded px-3 py-2 placeholder:text-gray-400"
        />

        {/* WhatsApp phone */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Store WhatsApp Phone (E.164)
          </label>
          <input
            type="text"
            placeholder="+9613123456"
            value={formData.whatsapp_phone}
            onChange={(e) =>
              setFormData({ ...formData, whatsapp_phone: e.target.value })
            }
            className="border rounded px-3 py-2 w-full placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used by the Admin “Send WhatsApp for Delivery” button. If empty,
            we’ll fall back to the branch Phone Number.
          </p>
        </div>

        <textarea
          placeholder="Address"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="border rounded px-3 py-2 col-span-2 placeholder:text-gray-400"
          rows="3"
        />
        <input
          type="text"
          placeholder="Location (e.g., address or coordinates)"
          value={formData.location}
          onChange={(e) =>
            setFormData({ ...formData, location: e.target.value })
          }
          className="border rounded px-3 py-2 col-span-2 placeholder:text-gray-400"
        />

        {/* Image URL Field */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch Image URL
          </label>
          <input
            type="text"
            placeholder="https://example.com/branch-image.jpg"
            value={formData.image_url}
            onChange={(e) => {
              setFormData({ ...formData, image_url: e.target.value });
              validateImageUrl(e.target.value);
            }}
            className={`border rounded px-3 py-2 w-full placeholder:text-gray-400 ${imageError ? "border-red-500" : "border-gray-300"}`}
          />
          {imageError && (
            <p className="text-red-500 text-sm mt-1">{imageError}</p>
          )}
          {formData.image_url && !imageError && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-2">Preview:</p>
              <img
                src={formData.image_url}
                alt="Branch preview"
                className="max-w-xs h-40 object-cover rounded border border-gray-300"
                onError={(e) => {
                  e.target.style.display = "none";
                  setImageError("Failed to load image from URL");
                }}
                onLoad={() => setImageError(null)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Discount Percentage (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            value={formData.discount_percentage}
            onChange={(e) =>
              setFormData({
                ...formData,
                discount_percentage: parseFloat(e.target.value) || 0,
              })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500">
            Applied to all products at this branch
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Delivery Radius (km)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="10"
            value={formData.delivery_radius_km}
            onChange={(e) =>
              setFormData({
                ...formData,
                delivery_radius_km: parseFloat(e.target.value) || 0,
              })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500">
            Delivery is allowed within this distance from the branch location.
          </p>
          <p className="text-xs text-gray-500">
            Branch Location should be a "lat,lng" pair (example:
            33.8938,35.5018).
          </p>
        </div>

        {/* Operational Controls Section */}
        <div className="col-span-2 mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-md font-semibold mb-3 text-gray-700">
            Operational Controls
          </h4>

          {/* Orders Active Checkbox */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.orders_active}
                onChange={(e) =>
                  setFormData({ ...formData, orders_active: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="font-medium">Orders Active</span>
            </label>
            <p className="text-xs text-gray-600 mt-1 ml-6">
              When unchecked, this branch will immediately stop accepting
              orders. Users cannot add items to cart or place orders.
            </p>
          </div>

          {/* Opening Hours */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opening Time
              </label>
              <input
                type="time"
                value={formData.opening_time}
                onChange={(e) =>
                  setFormData({ ...formData, opening_time: e.target.value })
                }
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Closing Time
              </label>
              <input
                type="time"
                value={formData.closing_time}
                onChange={(e) =>
                  setFormData({ ...formData, closing_time: e.target.value })
                }
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Pickup orders can only be scheduled during these hours
          </p>

          {/* Delivery Hours */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Start Time
              </label>
              <input
                type="time"
                value={formData.delivery_start_time}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    delivery_start_time: e.target.value,
                  })
                }
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery End Time
              </label>
              <input
                type="time"
                value={formData.delivery_end_time}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    delivery_end_time: e.target.value,
                  })
                }
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Delivery orders can only be scheduled during these hours
          </p>
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
