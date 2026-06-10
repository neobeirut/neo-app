import { useState, useEffect } from "react";
import { Plus, Minus } from "lucide-react";

function calcUnitPrice(
  product,
  allCustomizations,
  allProductAddons,
  selectedOptions,
  selectedCustomizations,
  selectedProductAddons,
) {
  const base = parseFloat(product.price || 0);
  let total = base;

  for (const ids of Object.values(selectedOptions)) {
    for (const id of ids) {
      const c = allCustomizations.find((c) => c.id === id);
      if (c) total += parseFloat(c.price || 0);
    }
  }

  for (const id of selectedCustomizations) {
    const c = allCustomizations.find((c) => c.id === id);
    if (c && c.customization_type === "addon") {
      total += parseFloat(c.price || 0);
    }
  }

  for (const id of selectedProductAddons) {
    const a = allProductAddons.find((a) => a.id === id);
    if (a) total += parseFloat(a.price || 0);
  }

  return total;
}

export function ItemCustomizationPanel({
  product,
  customizations,
  productAddons,
  initialOptions = {},
  initialCustomizations = [],
  initialProductAddons = [],
  initialQuantity = 1,
  initialNote = "",
  onChange,
}) {
  const [selectedOptions, setSelectedOptions] = useState(initialOptions);
  const [selectedCustomizations, setSelectedCustomizations] = useState(
    initialCustomizations,
  );
  const [selectedProductAddons, setSelectedProductAddons] =
    useState(initialProductAddons);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [note, setNote] = useState(initialNote);

  // Group options
  const optionGroups = {};
  for (const c of customizations.filter(
    (c) => c.customization_type === "option",
  )) {
    const group = c.option_group_name || "Options";
    if (!optionGroups[group]) {
      optionGroups[group] = {
        items: [],
        isRequired: false,
        isMultiSelect: false,
      };
    }
    optionGroups[group].items.push(c);
    if (c.is_required) optionGroups[group].isRequired = true;
    if (c.is_multi_select) optionGroups[group].isMultiSelect = true;
  }

  const customizationAddons = customizations.filter(
    (c) => c.customization_type === "addon",
  );
  const customizationRemovals = customizations.filter(
    (c) => c.customization_type === "remove",
  );

  const unitPrice = calcUnitPrice(
    product,
    customizations,
    productAddons,
    selectedOptions,
    selectedCustomizations,
    selectedProductAddons,
  );
  const totalPrice = unitPrice * quantity;

  // Notify parent whenever state changes
  useEffect(() => {
    if (onChange) {
      const computedUnitPrice = calcUnitPrice(
        product,
        customizations,
        productAddons,
        selectedOptions,
        selectedCustomizations,
        selectedProductAddons,
      );
      onChange({
        selectedOptions,
        selectedCustomizations,
        selectedProductAddons,
        quantity,
        note,
        unitPrice: computedUnitPrice,
        totalPrice: computedUnitPrice * quantity,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedOptions,
    selectedCustomizations,
    selectedProductAddons,
    quantity,
    note,
  ]);

  const toggleOption = (groupName, optionId, isMultiSelect) => {
    setSelectedOptions((prev) => {
      const current = prev[groupName] || [];
      if (isMultiSelect) {
        return {
          ...prev,
          [groupName]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      } else {
        return {
          ...prev,
          [groupName]: current.includes(optionId) ? [] : [optionId],
        };
      }
    });
  };

  const toggleCustomization = (id) => {
    setSelectedCustomizations((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const toggleProductAddon = (id) => {
    setSelectedProductAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-5">
      {/* Option Groups */}
      {Object.entries(optionGroups).map(([groupName, group]) => (
        <div key={groupName}>
          <div className="flex items-center gap-2 mb-2">
            <p className="font-medium text-gray-800 text-sm">{groupName}</p>
            {group.isRequired && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Required
              </span>
            )}
            {group.isMultiSelect && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Multi
              </span>
            )}
          </div>
          <div className="space-y-2">
            {group.items
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              .map((opt) => {
                const isSelected = (selectedOptions[groupName] || []).includes(
                  opt.id,
                );
                const price = parseFloat(opt.price || 0);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      toggleOption(groupName, opt.id, group.isMultiSelect)
                    }
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span>{opt.ingredient}</span>
                    {price > 0 && (
                      <span
                        className={
                          isSelected
                            ? "text-blue-600 font-medium"
                            : "text-gray-400"
                        }
                      >
                        +${price.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      {/* Customization Add-ons */}
      {customizationAddons.length > 0 && (
        <div>
          <p className="font-medium text-gray-800 text-sm mb-2">Add-ons</p>
          <div className="space-y-2">
            {customizationAddons.map((addon) => {
              const isSelected = selectedCustomizations.includes(addon.id);
              const price = parseFloat(addon.price || 0);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleCustomization(addon.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isSelected
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>+ {addon.ingredient}</span>
                  {price > 0 && (
                    <span
                      className={
                        isSelected
                          ? "text-green-600 font-medium"
                          : "text-gray-400"
                      }
                    >
                      +${price.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Removals */}
      {customizationRemovals.length > 0 && (
        <div>
          <p className="font-medium text-gray-800 text-sm mb-2">Remove</p>
          <div className="space-y-2">
            {customizationRemovals.map((removal) => {
              const isSelected = selectedCustomizations.includes(removal.id);
              return (
                <button
                  key={removal.id}
                  type="button"
                  onClick={() => toggleCustomization(removal.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isSelected
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>− No {removal.ingredient}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Add-ons */}
      {productAddons.length > 0 && (
        <div>
          <p className="font-medium text-gray-800 text-sm mb-2">
            Product Add-ons
          </p>
          <div className="space-y-2">
            {productAddons.map((addon) => {
              const isSelected = selectedProductAddons.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleProductAddon(addon.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isSelected
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{addon.name}</span>
                  <span
                    className={
                      isSelected
                        ? "text-green-600 font-medium"
                        : "text-gray-400"
                    }
                  >
                    +${parseFloat(addon.price).toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <div>
        <p className="font-medium text-gray-800 text-sm mb-2">Note</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Special instructions..."
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
      </div>

      {/* Quantity */}
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-800 text-sm">Quantity</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
            disabled={quantity <= 1}
          >
            <Minus size={14} />
          </button>
          <span className="w-8 text-center font-semibold text-gray-900">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Price Summary */}
      <div className="bg-gray-50 rounded-lg px-4 py-3 flex justify-between items-center border border-gray-200">
        <div>
          <p className="text-xs text-gray-400">
            ${unitPrice.toFixed(2)} × {quantity}
          </p>
          <p className="text-sm text-gray-600">Total</p>
        </div>
        <span className="font-bold text-xl text-gray-900">
          ${totalPrice.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
