"use client";

import { useState, useEffect } from "react";

export default function ProductCustomizationsSelector({ productId }) {
  const [allItems, setAllItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [productOptionDefaults, setProductOptionDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (productId) {
      fetchCustomizations();
    }
  }, [productId]);

  const fetchCustomizations = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/products/${productId}/link-customizations`,
      );
      if (response.ok) {
        const data = await response.json();
        setAllItems(data.allItems || []);

        // Convert linkedMap to selectedItems format
        const selected = {};
        Object.keys(data.linkedMap).forEach((itemId) => {
          selected[itemId] = {
            checked: true,
            price: data.linkedMap[itemId].price,
            is_active: data.linkedMap[itemId].is_active,
          };
        });
        setSelectedItems(selected);

        // Per-product option defaults (override). If empty, the app falls back to group default.
        const incomingDefaults =
          data.optionDefaults && typeof data.optionDefaults === "object"
            ? data.optionDefaults
            : {};
        setProductOptionDefaults(incomingDefaults);
      }
    } catch (error) {
      console.error("Error fetching customizations:", error);
    }
    setLoading(false);
  };

  const handleToggle = (itemId, defaultPrice, optionGroupName) => {
    const groupKey = optionGroupName || null;

    setSelectedItems((prev) => {
      if (prev[itemId]?.checked) {
        // Uncheck
        return {
          ...prev,
          [itemId]: { ...prev[itemId], checked: false },
        };
      } else {
        // Check
        return {
          ...prev,
          [itemId]: {
            checked: true,
            price: prev[itemId]?.price || defaultPrice,
            is_active: true,
          },
        };
      }
    });

    // If we unchecked the product-default option, clear the product override for that group.
    if (groupKey) {
      setProductOptionDefaults((prev) => {
        const current = Number(prev?.[groupKey]);
        if (Number(current) === Number(itemId)) {
          const next = { ...(prev || {}) };
          delete next[groupKey];
          return next;
        }
        return prev;
      });
    }
  };

  const handlePriceChange = (itemId, price) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], price },
    }));
  };

  const handleActiveToggle = (itemId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_active: !prev[itemId]?.is_active },
    }));
  };

  const setProductDefaultForGroup = (groupName, itemId) => {
    const key = groupName || "Options";
    setProductOptionDefaults((prev) => ({
      ...(prev || {}),
      [key]: Number(itemId),
    }));
  };

  const clearProductDefaultForGroup = (groupName) => {
    const key = groupName || "Options";
    setProductOptionDefaults((prev) => {
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build array of selected items
      const itemsToSave = Object.keys(selectedItems)
        .filter((itemId) => selectedItems[itemId].checked)
        .map((itemId) => ({
          customization_item_id: parseInt(itemId),
          price: parseFloat(selectedItems[itemId].price),
          is_active: selectedItems[itemId].is_active,
        }));

      const response = await fetch(
        `/api/products/${productId}/link-customizations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedItems: itemsToSave,
            optionDefaults: productOptionDefaults,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert("Customizations saved successfully!");
      } else {
        console.error("Server error:", data);
        alert(
          `Failed to save customizations: ${data.error || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error("Error saving customizations:", error);
      alert(`Failed to save customizations: ${error.message}`);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center py-4">Loading customizations...</div>;
  }

  const addons = allItems.filter((item) => item.customization_type === "addon");
  const removals = allItems.filter(
    (item) => item.customization_type === "remove",
  );
  const options = allItems.filter(
    (item) => item.customization_type === "option",
  );

  // Group options by option_group_name
  const optionGroups = options.reduce((acc, option) => {
    const groupName = option.option_group_name || "Options";
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(option);
    return acc;
  }, {});

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-lg font-semibold mb-4">Product Customizations</h3>
      <p className="text-sm text-gray-600 mb-4">
        Select which customizations are available for this product. Only{" "}
        <strong>checked and active</strong> items will show to customers.
      </p>

      {/* Options Section - NEW */}
      <div className="mb-8">
        <h4 className="font-semibold text-blue-700 mb-3 text-lg">
          Options (
          {options.filter((item) => selectedItems[item.id]?.checked).length}/
          {options.length} selected)
        </h4>
        <p className="text-sm text-gray-600 mb-3">
          Options allow customers to choose required selections (e.g., Protein,
          Bread type). These appear <strong>first</strong> on the product detail
          page.
        </p>
        <div className="space-y-4">
          {Object.keys(optionGroups).length === 0 ? (
            <p className="text-gray-500 text-sm border rounded p-4 bg-gray-50">
              No options available. Create option groups in the Customization
              Items tab first.
            </p>
          ) : (
            Object.keys(optionGroups).map((groupName) => {
              const groupList = optionGroups[groupName] || [];
              const groupDefault = groupList.find((x) => x.is_default) || null;

              const productDefaultItemId = Number(
                productOptionDefaults?.[groupName],
              );
              const productDefaultItem = groupList.find(
                (x) => Number(x.id) === Number(productDefaultItemId),
              );

              const hasProductDefault = !!productDefaultItem;

              return (
                <div
                  key={groupName}
                  className="border rounded-lg p-4 bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h5 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
                        <span className="text-blue-600">●</span>
                        {groupName}
                        <span className="text-xs text-gray-600 font-normal">
                          ({groupList.length} options in group)
                        </span>
                      </h5>
                      <div className="text-xs text-gray-700">
                        <div>
                          <span className="font-medium">Group default:</span>{" "}
                          {groupDefault?.name || "Not set"}
                        </div>
                        <div>
                          <span className="font-medium">Product default:</span>{" "}
                          {productDefaultItem?.name || "(uses group default)"}
                        </div>
                      </div>
                    </div>

                    {hasProductDefault ? (
                      <button
                        type="button"
                        onClick={() => clearProductDefaultForGroup(groupName)}
                        className="text-xs px-2 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        title="Clear product override (fall back to group default)"
                      >
                        Clear product default
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {groupList.map((item) => {
                      const groupOption = groupList[0];
                      const isRequired = groupOption?.is_required;
                      const isMultiSelect = groupOption?.is_multi_select;

                      const isChecked =
                        selectedItems[item.id]?.checked || false;
                      const isProductDefaultSelected =
                        isChecked &&
                        Number(productOptionDefaults?.[groupName]) ===
                          Number(item.id);

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-white rounded border"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              handleToggle(
                                item.id,
                                item.default_price,
                                item.option_group_name,
                              )
                            }
                            className="w-4 h-4"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{item.name}</span>
                            <div className="flex gap-2 mt-1">
                              {isRequired && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  Required
                                </span>
                              )}
                              {isMultiSelect && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  Multi-select
                                </span>
                              )}
                              {item.is_default ? (
                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                  Group default
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="radio"
                              name={`product-default-${groupName}`}
                              disabled={!isChecked}
                              checked={isProductDefaultSelected}
                              onChange={() =>
                                setProductDefaultForGroup(groupName, item.id)
                              }
                            />
                            Default
                          </label>

                          {isChecked && (
                            <>
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  selectedItems[item.id]?.price ||
                                  item.default_price
                                }
                                onChange={(e) =>
                                  handlePriceChange(item.id, e.target.value)
                                }
                                className="w-20 border rounded px-2 py-1 text-sm"
                                placeholder="Price"
                              />
                              <label className="flex items-center gap-1 text-sm">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedItems[item.id]?.is_active !== false
                                  }
                                  onChange={() => handleActiveToggle(item.id)}
                                  className="w-3 h-3"
                                />
                                <span className="text-gray-600">Show</span>
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Add-ons */}
        <div>
          <h4 className="font-semibold text-green-700 mb-3">
            Add-ons (
            {addons.filter((item) => selectedItems[item.id]?.checked).length}/
            {addons.length} selected)
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-4 bg-gray-50">
            {addons.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No add-ons available. Create them in the Customizations tab
                first.
              </p>
            ) : (
              addons.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-white rounded border"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems[item.id]?.checked || false}
                    onChange={() => handleToggle(item.id, item.default_price)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {selectedItems[item.id]?.checked && (
                    <>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          selectedItems[item.id]?.price || item.default_price
                        }
                        onChange={(e) =>
                          handlePriceChange(item.id, e.target.value)
                        }
                        className="w-20 border rounded px-2 py-1 text-sm"
                        placeholder="Price"
                      />
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedItems[item.id]?.is_active !== false}
                          onChange={() => handleActiveToggle(item.id)}
                          className="w-3 h-3"
                        />
                        <span className="text-gray-600">Show</span>
                      </label>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Removals */}
        <div>
          <h4 className="font-semibold text-red-700 mb-3">
            Removals (
            {removals.filter((item) => selectedItems[item.id]?.checked).length}/
            {removals.length} selected)
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-4 bg-gray-50">
            {removals.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No removals available. Create them in the Customizations tab
                first.
              </p>
            ) : (
              removals.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-white rounded border"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems[item.id]?.checked || false}
                    onChange={() => handleToggle(item.id, 0)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {selectedItems[item.id]?.checked && (
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedItems[item.id]?.is_active !== false}
                        onChange={() => handleActiveToggle(item.id)}
                        className="w-3 h-3"
                      />
                      <span className="text-gray-600">Show</span>
                    </label>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Customizations"}
      </button>
    </div>
  );
}
