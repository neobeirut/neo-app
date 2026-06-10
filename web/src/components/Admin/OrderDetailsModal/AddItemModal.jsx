import { useState, useEffect, useRef } from "react";
import { X, Search, ChevronLeft, Loader, Plus } from "lucide-react";
import { ItemCustomizationPanel } from "./ItemCustomizationPanel";

function buildCustomizationsPayload(
  allCustomizations,
  selectedOptions,
  selectedCustomizations,
) {
  const result = [];
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

function ProductList({ branchId, onSelect }) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);
        const url = branchId
          ? `/api/products?available_only=true&branch_id=${branchId}`
          : `/api/products?available_only=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        setError("Failed to load products.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [branchId]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader
              size={24}
              className="text-blue-500"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span className="ml-2 text-gray-500 text-sm">
              Loading products...
            </span>
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm text-center py-8">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            No products found.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {product.name}
                  </p>
                  {product.category_name && (
                    <p className="text-xs text-gray-400">
                      {product.category_name}
                    </p>
                  )}
                </div>
                <span className="font-semibold text-gray-900 text-sm flex-shrink-0">
                  ${parseFloat(product.price).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function CustomizationStep({ product, onBack, onAdd }) {
  const [customizations, setCustomizations] = useState([]);
  const [productAddons, setProductAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currentData, setCurrentData] = useState(null);
  const currentDataRef = useRef(null);

  useEffect(() => {
    currentDataRef.current = currentData;
  }, [currentData]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [custRes, addonsRes] = await Promise.all([
          fetch(`/api/products/${product.id}/customizations`),
          fetch(`/api/products/${product.id}/addons`),
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [product.id]);

  const handleAdd = () => {
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

    setAdding(true);

    const builtCustomizations = buildCustomizationsPayload(
      customizations,
      data.selectedOptions,
      data.selectedCustomizations,
    );

    const newItem = {
      // No `id` — it's a new item (server will assign one)
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url || null,
      quantity: data.quantity,
      comment: data.note || null,
      customizations: builtCustomizations,
      selected_addons: data.selectedProductAddons,
      unit_price: data.unitPrice,
      total_price: data.totalPrice,
      addons: data.selectedProductAddons
        .map((id) => {
          const a = productAddons.find((a) => a.id === id);
          return a ? { id: a.id, name: a.name, price: a.price } : null;
        })
        .filter(Boolean),
      // Temp key for React rendering until server assigns a real id
      _tempId: `temp-${Date.now()}-${Math.random()}`,
    };

    onAdd(newItem);
    setAdding(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header with product info */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-10 h-10 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {product.name}
          </p>
          <p className="text-xs text-gray-400">
            Base: ${parseFloat(product.price).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Customization Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader
              size={24}
              className="text-blue-500"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span className="ml-2 text-gray-500 text-sm">
              Loading options...
            </span>
          </div>
        ) : (
          <ItemCustomizationPanel
            key={`add-${product.id}`}
            product={product}
            customizations={customizations}
            productAddons={productAddons}
            initialOptions={{}}
            initialCustomizations={[]}
            initialProductAddons={[]}
            initialQuantity={1}
            initialNote=""
            onChange={setCurrentData}
          />
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {adding ? (
              <Loader
                size={16}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Plus size={16} />
            )}
            {adding ? "Adding..." : "Add to Order"}
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export function AddItemModal({ branchId, onClose, onAdd }) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleAdd = (newItem) => {
    onAdd(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ height: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-lg">
            {selectedProduct ? "Configure Item" : "Add Item to Order"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {!selectedProduct ? (
            <ProductList branchId={branchId} onSelect={setSelectedProduct} />
          ) : (
            <CustomizationStep
              product={selectedProduct}
              onBack={() => setSelectedProduct(null)}
              onAdd={handleAdd}
            />
          )}
        </div>
      </div>
    </div>
  );
}
