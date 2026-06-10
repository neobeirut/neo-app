"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ProductCustomizationsTable({ productId }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    ingredient: "",
    customization_type: "addon",
    price: 0,
    is_active: true,
  });

  // Fetch customizations
  const { data, isLoading } = useQuery({
    queryKey: ["product-customizations", productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/customizations`);
      if (!response.ok) throw new Error("Failed to fetch customizations");
      return response.json();
    },
    enabled: !!productId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newCustomization) => {
      const response = await fetch(
        `/api/products/${productId}/customizations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newCustomization),
        },
      );
      if (!response.ok) throw new Error("Failed to create customization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["product-customizations", productId]);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ customization_id, ...updates }) => {
      const response = await fetch(
        `/api/products/${productId}/customizations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customization_id, ...updates }),
        },
      );
      if (!response.ok) throw new Error("Failed to update customization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["product-customizations", productId]);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (customizationId) => {
      const response = await fetch(
        `/api/products/${productId}/customizations?customization_id=${customizationId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete customization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["product-customizations", productId]);
    },
  });

  const resetForm = () => {
    setFormData({
      ingredient: "",
      customization_type: "addon",
      price: 0,
      is_active: true,
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ customization_id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (customization) => {
    setEditingId(customization.id);
    setFormData({
      ingredient: customization.ingredient,
      customization_type: customization.customization_type,
      price: customization.price,
      is_active: customization.is_active,
    });
    setIsAdding(true);
  };

  const handleToggleActive = (customization) => {
    updateMutation.mutate({
      customization_id: customization.id,
      is_active: !customization.is_active,
    });
  };

  const customizations = data?.customizations || [];
  const addons = customizations.filter((c) => c.customization_type === "addon");
  const removals = customizations.filter(
    (c) => c.customization_type === "remove",
  );

  if (!productId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">
          Please save the product first before adding customizations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Product Customizations</h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Customization
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 border rounded bg-gray-50">
          <h4 className="font-semibold mb-4">
            {editingId ? "Edit Customization" : "Add New Customization"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Ingredient Name
              </label>
              <input
                type="text"
                value={formData.ingredient}
                onChange={(e) =>
                  setFormData({ ...formData, ingredient: e.target.value })
                }
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.customization_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customization_type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value="addon">Add-on (+price)</option>
                <option value="remove">Remove (free)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Price (SAR)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                disabled={formData.customization_type === "remove"}
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Show to customers</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Update" : "Add"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Customizations Tables */}
      {isLoading ? (
        <div className="text-center py-4">Loading customizations...</div>
      ) : (
        <div className="space-y-6">
          {/* Add-ons Table */}
          <div>
            <h4 className="font-semibold mb-2">Add-ons</h4>
            {addons.length === 0 ? (
              <p className="text-gray-500 text-sm">No add-ons yet</p>
            ) : (
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Active</th>
                    <th className="border p-2 text-left">Ingredient</th>
                    <th className="border p-2 text-left">Price (SAR)</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((customization) => (
                    <tr key={customization.id}>
                      <td className="border p-2">
                        <input
                          type="checkbox"
                          checked={customization.is_active}
                          onChange={() => handleToggleActive(customization)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border p-2">{customization.ingredient}</td>
                      <td className="border p-2">
                        {customization.price.toFixed(2)}
                      </td>
                      <td className="border p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(customization)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this customization?")) {
                                deleteMutation.mutate(customization.id);
                              }
                            }}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Removals Table */}
          <div>
            <h4 className="font-semibold mb-2">Removals</h4>
            {removals.length === 0 ? (
              <p className="text-gray-500 text-sm">No removal options yet</p>
            ) : (
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Active</th>
                    <th className="border p-2 text-left">Ingredient</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {removals.map((customization) => (
                    <tr key={customization.id}>
                      <td className="border p-2">
                        <input
                          type="checkbox"
                          checked={customization.is_active}
                          onChange={() => handleToggleActive(customization)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border p-2">{customization.ingredient}</td>
                      <td className="border p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(customization)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this customization?")) {
                                deleteMutation.mutate(customization.id);
                              }
                            }}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
