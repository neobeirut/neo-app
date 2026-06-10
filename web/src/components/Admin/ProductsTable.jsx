import { Edit2, Trash2, Star, GripVertical } from "lucide-react";
import { useState } from "react";

export function ProductsTable({
  products,
  onEdit,
  onDelete,
  onRefresh,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  setSelectedStatus,
}) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  // Remove local filter state - now controlled by parent
  // const [selectedCategory, setSelectedCategory] = useState("all");
  // const [selectedStatus, setSelectedStatus] = useState("all");
  const [updatingStatus, setUpdatingStatus] = useState({});

  const handleResetAllProducts = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL products and their related data (addons, reviews, etc.). This action cannot be undone. Are you absolutely sure?",
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      "Final confirmation: Type 'DELETE' in the next prompt to proceed",
    );

    if (!doubleConfirm) return;

    const finalConfirm = prompt(
      "Type DELETE in all caps to confirm deletion of all products:",
    );

    if (finalConfirm !== "DELETE") {
      alert("Reset cancelled - confirmation text did not match");
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch("/api/products", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to reset products");
      }

      alert("All products have been deleted successfully");

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error resetting products:", error);
      alert("Failed to reset products. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleStatusChange = async (productId, newStatus) => {
    setUpdatingStatus((prev) => ({ ...prev, [productId]: true }));

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          updateAllBranches: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [productId]: false }));
    }
  };

  // Safety check for products array
  if (!products || !Array.isArray(products)) {
    console.log("No products or not an array - showing no products message");
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">⚠️ No products available</div>
        <div className="text-sm text-gray-400 mb-2">
          <strong>Debug Info:</strong>
        </div>
        <div className="text-sm text-gray-400 mb-1">
          Type: {typeof products}
        </div>
        <div className="text-sm text-gray-400 mb-1">
          Is Array: {Array.isArray(products).toString()}
        </div>
        <div className="text-sm text-gray-400 mb-4">
          Value: {JSON.stringify(products)}
        </div>
        <div className="text-xs text-blue-600">
          Try refreshing the page or check the browser console for errors.
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    console.log("Products array is empty - showing no products message");
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-2">📦 No products found</div>
        <div className="text-sm text-gray-400">
          Products array exists but is empty ({products.length} items)
        </div>
        <div className="text-xs text-blue-600 mt-4">
          Click "Add New Product" to create your first product.
        </div>
      </div>
    );
  }

  // Get unique categories for filter
  const categories = [
    { id: "all", name: "All Categories" },
    ...Array.from(
      new Set(products.map((p) => p.category_name || "Uncategorized")),
    ).map((name) => ({ id: name, name })),
  ];

  // Status options for filtering
  const statusOptions = [
    { id: "all", name: "All Statuses" },
    { id: "Available", name: "Available" },
    { id: "Unavailable Today", name: "Unavailable Today" },
    { id: "Unavailable Until Further Notice", name: "On Hold" },
    { id: "Hide from Menu", name: "Hidden" },
  ];

  // Apply both category and status filters
  const filteredProducts = products.filter((product) => {
    const categoryMatch =
      selectedCategory === "all" ||
      (product.category_name || "Uncategorized") === selectedCategory;

    const statusMatch =
      selectedStatus === "all" || product.status === selectedStatus;

    return categoryMatch && statusMatch;
  });

  // Group products by category
  const productsByCategory = filteredProducts.reduce((acc, product) => {
    const categoryName = product.category_name || "Uncategorized";
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(product);
    return acc;
  }, {});

  // Sort products within each category by sort_order
  Object.keys(productsByCategory).forEach((categoryName) => {
    productsByCategory[categoryName].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    );
  });

  const handleDragStart = (e, product) => {
    setDraggedItem(product);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, product) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (
      draggedItem &&
      draggedItem.id !== product.id &&
      draggedItem.category_id === product.category_id
    ) {
      setDragOverItem(product);
    }
  };

  const handleDrop = async (e, targetProduct) => {
    e.preventDefault();

    if (
      !draggedItem ||
      draggedItem.id === targetProduct.id ||
      draggedItem.category_id !== targetProduct.category_id
    ) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const categoryProducts =
      productsByCategory[targetProduct.category_name || "Uncategorized"];
    const draggedIndex = categoryProducts.findIndex(
      (p) => p.id === draggedItem.id,
    );
    const targetIndex = categoryProducts.findIndex(
      (p) => p.id === targetProduct.id,
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder the products
    const reordered = [...categoryProducts];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Prepare batch update - send all products in one request
    const updates = reordered.map((product, index) => ({
      productId: product.id,
      sortOrder: index,
      categoryId: product.category_id,
    }));

    setIsUpdating(true);
    setDraggedItem(null);
    setDragOverItem(null);

    try {
      const response = await fetch("/api/products/sort-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates), // Send as array for batch processing
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update sort order");
      }

      // Use the refresh callback instead of full page reload
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error updating sort order:", error);
      alert("Failed to update product order. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const statusOptionsForDropdown = [
    "Available",
    "Unavailable Today",
    "Unavailable Until Further Notice",
    "Hide from Menu",
  ];

  return (
    <div className="space-y-8">
      {/* Enhanced Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left side: Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filter by:
            </span>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">
                Category:
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">
                Status:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
              >
                {statusOptions.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Results Count */}
            <span className="text-sm text-gray-500 whitespace-nowrap">
              ({filteredProducts.length} product
              {filteredProducts.length !== 1 ? "s" : ""})
            </span>
          </div>

          {/* Right side: Reset All Button */}
          <button
            onClick={handleResetAllProducts}
            disabled={isResetting || products.length === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            <Trash2 size={16} />
            {isResetting ? "Deleting..." : "Reset All Products"}
          </button>
        </div>

        {/* Active Filters Indicator */}
        {(selectedCategory !== "all" || selectedStatus !== "all") && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Active filters:</span>
            {selectedCategory !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                Category: {selectedCategory}
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  ×
                </button>
              </span>
            )}
            {selectedStatus !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                Status:{" "}
                {statusOptions.find((s) => s.id === selectedStatus)?.name}
                <button
                  onClick={() => setSelectedStatus("all")}
                  className="hover:bg-green-200 rounded-full p-0.5"
                >
                  ×
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedCategory("all");
                setSelectedStatus("all");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* No Results State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-400 text-4xl mb-3">🔍</div>
          <div className="text-gray-600 font-medium mb-1">
            No products found
          </div>
          <div className="text-sm text-gray-500">
            Try adjusting your filters to see more results
          </div>
        </div>
      )}

      {isUpdating && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Updating order...
        </div>
      )}

      {Object.entries(productsByCategory).map(
        ([categoryName, categoryProducts]) => (
          <div key={categoryName}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 px-6">
              {categoryName}
            </h3>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-sm font-medium text-gray-500 w-8"></th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                    Status (All Branches)
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                    Flags
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categoryProducts.map((product) => (
                  <tr
                    key={product.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, product)}
                    onDragOver={(e) => handleDragOver(e, product)}
                    onDrop={(e) => handleDrop(e, product)}
                    onDragEnd={handleDragEnd}
                    className={`
                    ${draggedItem?.id === product.id ? "opacity-50" : ""}
                    ${dragOverItem?.id === product.id ? "bg-blue-50" : ""}
                    cursor-move hover:bg-gray-50 transition-colors
                  `}
                  >
                    <td className="px-2 py-4">
                      <GripVertical size={16} className="text-gray-400" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <span className="text-sm text-gray-900">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${product.price}
                      {product.original_price && (
                        <span className="text-gray-500 line-through ml-2">
                          ${product.original_price}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <select
                        value={product.status || "Available"}
                        onChange={(e) =>
                          handleStatusChange(product.id, e.target.value)
                        }
                        disabled={updatingStatus[product.id]}
                        className={`px-2 py-1 text-xs rounded border-0 cursor-pointer ${
                          product.status === "Available"
                            ? "bg-green-100 text-green-800"
                            : product.status === "Unavailable Today"
                              ? "bg-yellow-100 text-yellow-800"
                              : product.status ===
                                  "Unavailable Until Further Notice"
                                ? "bg-red-100 text-red-800"
                                : product.status === "Hide from Menu"
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-blue-100 text-blue-800"
                        } ${updatingStatus[product.id] ? "opacity-50" : ""}`}
                      >
                        {statusOptionsForDropdown.map((status) => (
                          <option key={status} value={status}>
                            {status === "Unavailable Until Further Notice"
                              ? "On Hold"
                              : status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-400" />
                        {product.rating}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {product.is_featured && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Featured
                          </span>
                        )}
                        {product.is_special && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                            Special
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(product)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(product.id, "products")}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
