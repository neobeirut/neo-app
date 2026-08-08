"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function CustomizationItemsView({ items = [] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    customization_type: "addon",
    default_price: "0.00",
    is_active: true,
    is_default: false,
    option_group_name: "",
    is_required: false,
    is_multi_select: false,
    display_order: 0,
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/customization-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create customization item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["customization-items"]);
      setIsAdding(false);
      setFormData({
        name: "",
        customization_type: "addon",
        default_price: "0.00",
        is_active: true,
        is_default: false,
        option_group_name: "",
        is_required: false,
        is_multi_select: false,
        display_order: 0,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/customization-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update customization item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["customization-items"]);
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/customization-items?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete customization item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["customization-items"]);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ ...formData, id: editingId });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      customization_type: item.customization_type,
      default_price: item.default_price,
      is_active: item.is_active,
      is_default: item.is_default || false,
      option_group_name: item.option_group_name || "",
      is_required: item.is_required || false,
      is_multi_select: item.is_multi_select || false,
      display_order: item.display_order || 0,
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: "",
      customization_type: "addon",
      default_price: "0.00",
      is_active: true,
      is_default: false,
      option_group_name: "",
      is_required: false,
      is_multi_select: false,
      display_order: 0,
    });
  };

  // Separate items by type
  const options = items.filter((item) => item.customization_type === "option");
  const addons = items
    .filter((item) => item.customization_type === "addon")
    .sort((a, b) => a.name.localeCompare(b.name));
  const removals = items
    .filter((item) => item.customization_type === "remove")
    .sort((a, b) => a.name.localeCompare(b.name));

  // Group options by option_group_name
  const optionGroups = options.reduce((acc, option) => {
    const groupName = option.option_group_name || "Ungrouped";
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(option);
    return acc;
  }, {});

  // Sort options within each group alphabetically
  Object.keys(optionGroups).forEach((groupName) => {
    optionGroups[groupName].sort((a, b) => a.name.localeCompare(b.name));
  });

  const setDefaultForOptionGroup = (item) => {
    if (!item?.id) return;
    if (item.customization_type !== "option") return;

    updateMutation.mutate({
      id: item.id,
      is_default: true,
      option_group_name: item.option_group_name || "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Customization Items Library</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Add Customization Item
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 p-6 rounded-lg space-y-4"
        >
          <h3 className="font-semibold text-lg">
            {editingId ? "Edit" : "Add New"} Customization Item
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className="w-full border rounded px-3 py-2 text-gray-900"
              >
                <option value="option">Option</option>
                <option value="addon">Add-on</option>
                <option value="remove">Removal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border rounded px-3 py-2 placeholder:text-gray-400"
                placeholder={
                  formData.customization_type === "option"
                    ? "e.g., Ham, Turkey, White Bread"
                    : "e.g., Extra Cheese, No Onions"
                }
                required
              />
            </div>

            {formData.customization_type === "option" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={formData.option_group_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        option_group_name: e.target.value,
                      })
                    }
                    className="w-full border rounded px-3 py-2 placeholder:text-gray-400"
                    placeholder="e.g., Protein, Bread Type, Size"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        display_order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border rounded px-3 py-2 placeholder:text-gray-400"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                {formData.customization_type === "option"
                  ? "Additional Price"
                  : "Default Price"}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.default_price}
                onChange={(e) =>
                  setFormData({ ...formData, default_price: e.target.value })
                }
                className="w-full border rounded px-3 py-2 placeholder:text-gray-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Active</span>
              </label>

              {formData.customization_type === "option" && (
                <>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_default: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Default choice for this group
                    </span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_required: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Required Selection
                    </span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_multi_select}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_multi_select: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Allow Multiple Selection
                    </span>
                  </label>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingId
                  ? "Update"
                  : "Add"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
          {(createMutation.error || updateMutation.error) && (
            <div className="text-red-600 text-sm">
              {createMutation.error?.message || updateMutation.error?.message}
            </div>
          )}
        </form>
      )}

      <div className="space-y-6">
        {/* Options Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-blue-700">
            Options ({options.length})
          </h3>
          {Object.keys(optionGroups).length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No option groups created yet
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(optionGroups)
                .sort(([, a], [, b]) => {
                  const orderA = a[0]?.display_order || 0;
                  const orderB = b[0]?.display_order || 0;
                  return orderA - orderB;
                })
                .map(([groupName, groupOptions]) => {
                  const firstOption = groupOptions[0];
                  const defaultOptionId = groupOptions.find(
                    (x) => x.is_default,
                  )?.id;

                  return (
                    <div
                      key={groupName}
                      className="bg-white rounded-lg shadow overflow-hidden"
                    >
                      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-blue-900">
                            {groupName}
                          </h4>
                          <div className="flex gap-2 text-xs">
                            {firstOption?.is_required && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                                Required
                              </span>
                            )}
                            {firstOption?.is_multi_select && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                Multi-Select
                              </span>
                            )}
                            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              Order: {firstOption?.display_order || 0}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-blue-900/80">
                          Default: {defaultOptionId ? "Set" : "Not set"}
                        </div>
                      </div>
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                              Choice
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                              Additional Price
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                              Default
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                              Active
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {groupOptions.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 text-sm">{item.name}</td>
                              <td className="px-4 py-3 text-sm">
                                ${parseFloat(item.default_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <button
                                  type="button"
                                  onClick={() => setDefaultForOptionGroup(item)}
                                  disabled={updateMutation.isPending}
                                  className={`text-xs px-2 py-1 rounded border ${
                                    item.is_default
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                  }`}
                                  title="Set this as the default choice for the group"
                                >
                                  {item.is_default ? "Default" : "Set"}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    item.is_active
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {item.is_active ? "Yes" : "No"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm space-x-2">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Delete "${item.name}"? This will remove it from all products.`,
                                      )
                                    ) {
                                      deleteMutation.mutate(item.id);
                                    }
                                  }}
                                  className="text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add-ons Table */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-green-700">
              Add-ons ({addons.length})
            </h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Active
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {addons.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm">{item.name}</td>
                      <td className="px-4 py-3 text-sm">
                        ${parseFloat(item.default_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            item.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.is_active ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Delete "${item.name}"? This will remove it from all products.`,
                              )
                            ) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {addons.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No add-ons created yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Removals Table */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-red-700">
              Removals ({removals.length})
            </h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Active
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {removals.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm">{item.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            item.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.is_active ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Delete "${item.name}"? This will remove it from all products.`,
                              )
                            ) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {removals.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No removals created yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
