import { useState } from "react";
import ProductCustomizationsSelector from "./ProductCustomizationsSelector";
import ProductRecommendationsSelector from "./ProductRecommendationsSelector";

export function ProductForm({
  editingItem,
  categories,
  products,
  onSave,
  onCancel,
}) {
  const [formData, setFormData] = useState({
    name: editingItem?.name || "",
    description: editingItem?.description || "",
    price: editingItem?.price || "",
    original_price: editingItem?.original_price || "",
    image_url: editingItem?.image_url || "",
    category_id: editingItem?.category_id || "",
    prep_time: editingItem?.prep_time || "",
    ingredients: editingItem?.ingredients || "",
    nutritional_info: editingItem?.nutritional_info || "",
    is_featured: editingItem?.is_featured || false,
    is_special: editingItem?.is_special || false,
    status: editingItem?.status || "Available",
    inventory_applies: editingItem?.inventory_applies || false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    // Clear previous errors
    setError(null);

    // Validate required fields
    if (!formData.name.trim()) {
      setError("Product name is required");
      return;
    }

    if (!formData.price || formData.price <= 0) {
      setError("Valid price is required");
      return;
    }

    setIsSaving(true);

    try {
      // Clean up the data before sending
      const cleanData = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        original_price: formData.original_price
          ? parseFloat(formData.original_price)
          : null,
        category_id: formData.category_id
          ? parseInt(formData.category_id)
          : null,
        inventory_applies: !!formData.inventory_applies,
      };

      const dataToSave = editingItem
        ? { ...cleanData, id: editingItem.id }
        : cleanData;

      console.log("Submitting product data:", dataToSave);

      const success = await onSave(dataToSave);

      if (success) {
        // Reset form for new products
        if (!editingItem) {
          setFormData({
            name: "",
            description: "",
            price: "",
            original_price: "",
            image_url: "",
            category_id: "",
            prep_time: "",
            ingredients: "",
            nutritional_info: "",
            is_featured: false,
            is_special: false,
            status: "Available",
            inventory_applies: false,
          });
        }
        // Only close/cancel if save was successful
        onCancel();
      } else {
        setError(
          "Failed to save product. Please check the details and try again.",
        );
      }
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Product Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            disabled={isSaving}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price *"
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: e.target.value })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            disabled={isSaving}
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="border rounded px-3 py-2 col-span-2 placeholder:text-gray-400"
            rows="3"
            disabled={isSaving}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Regular Price (leave blank if not discounted)"
            value={formData.original_price}
            onChange={(e) =>
              setFormData({
                ...formData,
                original_price: e.target.value,
              })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            title="Enter the regular price to show discount. If this is higher than the current price, customers will see the savings."
            disabled={isSaving}
          />
          <input
            type="url"
            placeholder="Image URL"
            value={formData.image_url}
            onChange={(e) =>
              setFormData({ ...formData, image_url: e.target.value })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            disabled={isSaving}
          />
          <select
            value={formData.category_id}
            onChange={(e) =>
              setFormData({
                ...formData,
                category_id: e.target.value,
              })
            }
            className="border rounded px-3 py-2 text-gray-900"
            disabled={isSaving}
          >
            <option value="" className="text-gray-400">
              Select Category
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Prep Time (e.g., 15 mins)"
            value={formData.prep_time}
            onChange={(e) =>
              setFormData({ ...formData, prep_time: e.target.value })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            disabled={isSaving}
          />
          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value })
            }
            className="border rounded px-3 py-2 text-gray-900"
            disabled={isSaving}
          >
            <option value="Available">Available</option>
            <option value="Unavailable Today">Unavailable Today</option>
            <option value="Unavailable Until Further Notice">
              Unavailable Until Further Notice
            </option>
            <option value="Hide from Menu">Hide from Menu</option>
          </select>
          <textarea
            placeholder="Ingredients"
            value={formData.ingredients}
            onChange={(e) =>
              setFormData({ ...formData, ingredients: e.target.value })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            rows="2"
            disabled={isSaving}
          />
          <textarea
            placeholder="Nutritional Info (e.g., 250 calories, 12g protein, 8g fat, 35g carbs, 3g fiber, 5g sugar)"
            value={formData.nutritional_info}
            onChange={(e) =>
              setFormData({ ...formData, nutritional_info: e.target.value })
            }
            className="border rounded px-3 py-2 placeholder:text-gray-400"
            rows="2"
            disabled={isSaving}
          />
          <div className="flex gap-4 col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) =>
                  setFormData({ ...formData, is_featured: e.target.checked })
                }
                disabled={isSaving}
              />
              Featured
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_special}
                onChange={(e) =>
                  setFormData({ ...formData, is_special: e.target.checked })
                }
                disabled={isSaving}
              />
              Special
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.inventory_applies}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inventory_applies: e.target.checked,
                  })
                }
                disabled={isSaving}
              />
              Inventory applies
            </label>
            <span
              className="text-xs text-gray-500 self-center"
              title="If enabled, you'll set Quantity on Hand per branch in the Product Status by Branch table."
            >
              (per-branch stock)
            </span>
          </div>
        </div>
      </div>

      {/* Sticky Action Buttons */}
      <div className="sticky bottom-0 bg-white pt-4 pb-2 mt-6 border-t border-gray-200 -mx-6 px-6 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {isSaving
            ? "Saving..."
            : editingItem
              ? "Update Product"
              : "Save Product"}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="bg-gray-500 text-white px-6 py-2.5 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Customizations Section - Only show for existing products */}
      {editingItem && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <ProductCustomizationsSelector productId={editingItem.id} />
        </div>
      )}

      {/* "You Might Also Like" manual overrides - Only show for existing products */}
      {editingItem ? (
        <ProductRecommendationsSelector
          productId={editingItem.id}
          allProducts={products}
        />
      ) : null}
    </div>
  );
}
