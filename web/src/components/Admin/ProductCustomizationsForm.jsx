"use client";

import { useState, useEffect } from "react";

export default function ProductCustomizationsForm({ productId }) {
  const [customizations, setCustomizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCustomization, setNewCustomization] = useState({
    ingredient: "",
    customization_type: "addon",
    price: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchCustomizations();
  }, [productId]);

  const fetchCustomizations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${productId}/customizations`);
      if (response.ok) {
        const data = await response.json();
        setCustomizations(data.customizations || []);
      }
    } catch (error) {
      console.error("Error fetching customizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomization = async (e) => {
    e.preventDefault();

    if (!newCustomization.ingredient.trim()) {
      alert("Please enter an ingredient name");
      return;
    }

    try {
      const response = await fetch(
        `/api/products/${productId}/customizations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newCustomization),
        },
      );

      if (response.ok) {
        setNewCustomization({
          ingredient: "",
          customization_type: "addon",
          price: 0,
          is_active: true,
        });
        fetchCustomizations();
      } else {
        alert("Failed to add customization");
      }
    } catch (error) {
      console.error("Error adding customization:", error);
      alert("Failed to add customization");
    }
  };

  const handleToggleActive = async (customizationId, currentStatus) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/customizations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customization_id: customizationId,
            is_active: !currentStatus,
          }),
        },
      );

      if (response.ok) {
        fetchCustomizations();
      }
    } catch (error) {
      console.error("Error toggling customization:", error);
    }
  };

  const handleDelete = async (customizationId) => {
    if (!confirm("Are you sure you want to delete this customization?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/products/${productId}/customizations?customization_id=${customizationId}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        fetchCustomizations();
      }
    } catch (error) {
      console.error("Error deleting customization:", error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading customizations...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Product Customizations</h3>

      {/* Add New Customization Form */}
      <form
        onSubmit={handleAddCustomization}
        className="bg-gray-50 p-4 rounded-lg space-y-4"
      >
        <h4 className="font-medium">Add New Customization</h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ingredient Name
            </label>
            <input
              type="text"
              value={newCustomization.ingredient}
              onChange={(e) =>
                setNewCustomization({
                  ...newCustomization,
                  ingredient: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., Extra Cheese"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={newCustomization.customization_type}
              onChange={(e) =>
                setNewCustomization({
                  ...newCustomization,
                  customization_type: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="addon">Add-on</option>
              <option value="remove">Remove</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newCustomization.price}
              onChange={(e) =>
                setNewCustomization({
                  ...newCustomization,
                  price: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </form>

      {/* Customizations List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ingredient
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customizations.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No customizations added yet
                  </td>
                </tr>
              ) : (
                customizations.map((customization) => (
                  <tr key={customization.id}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={customization.is_active}
                        onChange={() =>
                          handleToggleActive(
                            customization.id,
                            customization.is_active,
                          )
                        }
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {customization.ingredient}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          customization.customization_type === "addon"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {customization.customization_type === "addon"
                          ? "Add-on"
                          : "Remove"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${parseFloat(customization.price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(customization.id)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>
          <strong>Note:</strong> Only checked customizations will be shown to
          customers. Add-ons will add to the product price, while removals are
          free.
        </p>
      </div>
    </div>
  );
}
