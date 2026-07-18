import { useState, useEffect, useRef } from "react";
import { X, Save, Loader } from "lucide-react";
import { ItemCustomizationPanel } from "./ItemCustomizationPanel";

function buildCustomizationsPayload(
  allCustomizations,
  selectedOptions,
  selectedCustomizations,
) {
  const result = [];

  // Options
  for (const [groupName, ids] of Object.entries(selectedOptions)) {
    for (const id of ids) {
      const c = allCustomizations.find((c) => c.id === id);
      if (c) {
        result.push({
          id: c.id,
          ingredient: c.ingredient,
          customization_type: "option",
          price: parseFloat(c.price || 0),
          option_group_name: groupName,
        });
      }
    }
  }

  // Customization addons + removals
  for (const id of selectedCustomizations) {
    const c = allCustomizations.find((c) => c.id === id);
    if (c) {
      result.push({
        id: c.id,
        ingredient: c.ingredient,
        customization_type: c.customization_type,
        price: parseFloat(c.price || 0),
      });
    }
  }

  return result;
}

function extractInitialSelections(item, allCustomizations) {
  const initialOptions = {};
  const initialCustomizations = [];

  for (const c of item.customizations || []) {
    const cType = c.customization_type || c.type;
    if (cType === "option") {
      const group = c.option_group_name || "Options";
      if (!initialOptions[group]) initialOptions[group] = [];
      // Match by id or by ingredient name as fallback
      const matched = allCustomizations.find(
        (ac) => (c.id && ac.id === c.id) || ac.ingredient === c.ingredient,
      );
      if (matched) initialOptions[group].push(matched.id);
    } else if (cType === "addon" || cType === "remove") {
      const matched = allCustomizations.find(
        (ac) => (c.id && ac.id === c.id) || ac.ingredient === c.ingredient,
      );
      if (matched) initialCustomizations.push(matched.id);
    }
  }

  return { initialOptions, initialCustomizations };
}

export function ItemEditModal({ item, onClose, onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customizations, setCustomizations] = useState([]);
  const [productAddons, setProductAddons] = useState([]);
  const [currentData, setCurrentData] = useState(null);

  // Keep ref to latest data for save button
  const currentDataRef = useRef(null);
  useEffect(() => {
    currentDataRef.current = currentData;
  }, [currentData]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [custRes, addonsRes] = await Promise.all([
          fetch(`/api/products/${item.product_id}/customizations`),
          fetch(`/api/products/${item.product_id}/addons`),
        ]);

        const custData = custRes.ok
          ? await custRes.json()
          : { customizations: [] };
        const addonsData = addonsRes.ok
          ? await addonsRes.json()
          : { addons: [] };

        setCustomizations(custData.customizations || []);
        setProductAddons(addonsData.addons || []);
      } catch (err) {
        setError("Failed to load product details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [item.product_id]);

  // Derive initial selections after customizations load
  const { initialOptions, initialCustomizations } = loading
    ? { initialOptions: {}, initialCustomizations: [] }
    : extractInitialSelections(item, customizations);

  // Product addons: item.addons from DB are {id: pa.id, name, price}
  const initialProductAddons = (item.addons || [])
    .map((a) => a.id)
    .filter(Boolean);

  const handleSave = () => {
    const data = currentDataRef.current;
    if (!data) return;

    // Validate required option groups
    const requiredGroups = customizations
      .filter((c) => c.customization_type === "option" && c.is_required)
      .map((c) => c.option_group_name || "Options");
    const uniqueRequired = [...new Set(requiredGroups)];

    for (const group of uniqueRequired) {
      if (
        !data.selectedOptions[group] ||
        data.selectedOptions[group].length === 0
      ) {
        alert(`Please select a "${group}" option (required).`);
        return;
      }
    }

    setSaving(true);

    const builtCustomizations = buildCustomizationsPayload(
      customizations,
      data.selectedOptions,
      data.selectedCustomizations,
    );

    const updatedItem = {
      ...item,
      quantity: data.quantity,
      comment: data.note || null,
      customizations: builtCustomizations,
      selected_addons: data.selectedProductAddons,
      unit_price: data.unitPrice,
      total_price: data.totalPrice,
      // Rebuild addons display from selected product addons
      addons: data.selectedProductAddons
        .map((id) => {
          const a = productAddons.find((a) => a.id === id);
          return a ? { id: a.id, name: a.name, price: a.price } : null;
        })
        .filter(Boolean),
    };

    onSave(updatedItem);
    setSaving(false);
  };

  const product = {
    id: item.product_id,
    name: item.product_name,
    image_url: item.product_image,
    price: item.unit_price,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Edit Item</h2>
            <p className="text-sm text-gray-500">{item.product_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={28} className="animate-spin text-blue-500" />
              <span className="ml-3 text-gray-500">Loading options...</span>
            </div>
          ) : error ? (
            <div className="text-red-600 text-sm text-center py-8">{error}</div>
          ) : (
            <ItemCustomizationPanel
              key={`edit-${item.id}`}
              product={product}
              customizations={customizations}
              productAddons={productAddons}
              initialOptions={initialOptions}
              initialCustomizations={initialCustomizations}
              initialProductAddons={initialProductAddons}
              initialQuantity={item.quantity || 1}
              initialNote={item.comment || ""}
              onChange={setCurrentData}
            />
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="px-5 py-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
