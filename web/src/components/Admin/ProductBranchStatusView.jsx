import { useState, useEffect } from "react";

export function ProductBranchStatusView({ products, branches, adminUser }) {
  // Filter branches based on admin's access level
  // Branch managers: only their branch
  // HQ admins (no branch_id or backend role): all branches
  const isHQAdmin =
    !adminUser?.branch_id ||
    (Array.isArray(adminUser?.roles) && adminUser.roles.includes("backend"));

  const filteredBranches = isHQAdmin
    ? branches || []
    : (branches || []).filter((b) => b.id === adminUser?.branch_id);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("Available");
  const [productStatuses, setProductStatuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // NEW: local draft values so typing doesn't trigger a refetch on every keypress
  const [priceDrafts, setPriceDrafts] = useState({});
  const [qtyDrafts, setQtyDrafts] = useState({});

  // Auto-select branch if admin only has access to one branch
  useEffect(() => {
    if (filteredBranches.length === 1 && !selectedBranch) {
      setSelectedBranch(String(filteredBranches[0].id));
    }
  }, [filteredBranches, selectedBranch]);

  const getAdminHeaders = () => {
    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");
      if (!adminToken || !adminId) {
        return {};
      }
      return {
        "x-admin-token": adminToken,
        "x-admin-id": adminId, // dev fallback
      };
    } catch (e) {
      return {};
    }
  };

  const statusOptions = [
    "Available",
    "Unavailable Today",
    "Unavailable Until Further Notice",
    "Hide from Menu",
  ];

  const statusColors = {
    Available: "bg-green-100 text-green-800",
    "Unavailable Today": "bg-yellow-100 text-yellow-800",
    "Unavailable Until Further Notice": "bg-red-100 text-red-800",
    "Hide from Menu": "bg-gray-100 text-gray-800",
    Active: "bg-blue-100 text-blue-800",
  };

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const fetchProductStatuses = async (branchId) => {
    if (!branchId) {
      setProductStatuses([]);
      // NEW: clear drafts when branch is cleared
      setPriceDrafts({});
      setQtyDrafts({});
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/product-branch-status?branch_id=${branchId}`,
      );
      if (response.ok) {
        const data = await response.json();

        // API returns products array with status, price and inventory already included
        const allProductStatuses = (data.products || []).map((product) => ({
          product_id: product.id,
          product_name: product.name,
          category_id: product.category_id,
          status: product.status || "Available",
          base_price: product.base_price,
          branch_price: product.branch_price,
          price: product.price, // Effective price (branch override or base)
          inventory_applies: !!product.inventory_applies,
          quantity_on_hand:
            product.quantity_on_hand === undefined
              ? null
              : product.quantity_on_hand,
        }));

        setProductStatuses(allProductStatuses);

        // NEW: reset drafts to server values after fetch (safe because we now save onBlur)
        const nextPriceDrafts = {};
        const nextQtyDrafts = {};
        for (const p of allProductStatuses) {
          nextPriceDrafts[p.product_id] = p.branch_price ?? "";
          nextQtyDrafts[p.product_id] =
            p.quantity_on_hand === null || p.quantity_on_hand === undefined
              ? ""
              : String(p.quantity_on_hand);
        }
        setPriceDrafts(nextPriceDrafts);
        setQtyDrafts(nextQtyDrafts);
      }
    } catch (error) {
      console.error("Error fetching product statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProductStatus = async (productId, newStatus) => {
    try {
      const currentProduct = productStatuses.find(
        (p) => p.product_id === productId,
      );
      const response = await fetch("/api/product-branch-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          product_id: productId,
          branch_id: selectedBranch,
          status: newStatus,
          price: currentProduct?.branch_price, // Keep existing price
          quantity_on_hand: currentProduct?.quantity_on_hand, // Keep existing qty
        }),
      });

      if (response.ok) {
        // Update local state
        setProductStatuses((prev) =>
          prev.map((p) =>
            p.product_id === productId ? { ...p, status: newStatus } : p,
          ),
        );
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating product status:", error);
      alert(error.message || "Failed to update product status");
    }
  };

  const updateProductPrice = async (productId, newPrice) => {
    try {
      const currentProduct = productStatuses.find(
        (p) => p.product_id === productId,
      );
      const response = await fetch("/api/product-branch-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          product_id: productId,
          branch_id: selectedBranch,
          status: currentProduct?.status,
          price: newPrice === "" ? null : parseFloat(newPrice), // null removes override
          quantity_on_hand: currentProduct?.quantity_on_hand, // Keep existing qty
        }),
      });

      if (response.ok) {
        // Refetch to get the updated effective price
        await fetchProductStatuses(selectedBranch);
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update price");
      }
    } catch (error) {
      console.error("Error updating product price:", error);
      alert(error.message || "Failed to update product price");
    }
  };

  const updateProductQuantity = async (productId, newQty) => {
    try {
      const currentProduct = productStatuses.find(
        (p) => p.product_id === productId,
      );

      const parsedQty = newQty === "" ? null : parseInt(newQty, 10);

      const response = await fetch("/api/product-branch-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          product_id: productId,
          branch_id: selectedBranch,
          status: currentProduct?.status,
          price: currentProduct?.branch_price,
          quantity_on_hand: parsedQty,
        }),
      });

      if (response.ok) {
        await fetchProductStatuses(selectedBranch);
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update quantity");
      }
    } catch (error) {
      console.error("Error updating product quantity:", error);
      alert(error.message || "Failed to update inventory quantity");
    }
  };

  // NEW: commit helpers (save only when user finishes typing)
  const commitPrice = async (productId) => {
    const value = priceDrafts[productId] ?? "";

    const current = productStatuses.find((p) => p.product_id === productId);
    const serverValue = current?.branch_price ?? "";

    // avoid unnecessary writes
    if (String(value) === String(serverValue)) {
      return;
    }

    // allow clearing override
    if (value === "") {
      await updateProductPrice(productId, "");
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      alert("Please enter a valid price");
      setPriceDrafts((prev) => ({ ...prev, [productId]: serverValue }));
      return;
    }

    await updateProductPrice(productId, value);
  };

  const commitQty = async (productId) => {
    const value = qtyDrafts[productId] ?? "";

    const current = productStatuses.find((p) => p.product_id === productId);
    const serverValue =
      current?.quantity_on_hand === null ||
      current?.quantity_on_hand === undefined
        ? ""
        : String(current.quantity_on_hand);

    // avoid unnecessary writes
    if (String(value) === String(serverValue)) {
      return;
    }

    // allow clearing (NULL)
    if (value === "") {
      await updateProductQuantity(productId, "");
      return;
    }

    const parsed = Number(value);
    const isInt = Number.isFinite(parsed) && Number.isInteger(parsed);

    if (!isInt || parsed < 0) {
      alert("Please enter a valid whole number quantity (0 or more)");
      setQtyDrafts((prev) => ({ ...prev, [productId]: serverValue }));
      return;
    }

    await updateProductQuantity(productId, value);
  };

  useEffect(() => {
    fetchProductStatuses(selectedBranch);
  }, [selectedBranch]);

  // Filter products by category and status
  const filteredProducts = productStatuses.filter((p) => {
    const matchesCategory =
      selectedCategory === "all" ||
      p.category_id === parseInt(selectedCategory);
    const matchesStatus =
      selectedStatus === "all" || p.status === selectedStatus;
    return matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Product Status by Branch</h3>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Branch
              {!isHQAdmin && adminUser?.branch_name && (
                <span className="ml-2 text-xs text-gray-500">
                  (Showing only: {adminUser.branch_name})
                </span>
              )}
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              disabled={filteredBranches.length === 1}
            >
              {filteredBranches.length === 0 ? (
                <option value="">No branches available</option>
              ) : filteredBranches.length === 1 ? (
                <option value={filteredBranches[0].id}>
                  {filteredBranches[0].name}
                </option>
              ) : (
                <>
                  <option value="">Choose a branch...</option>
                  {filteredBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="text-center py-4">Loading product statuses...</div>
        )}

        {selectedBranch && !loading && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inventory
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Change Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((item, index) => (
                  <tr key={item.product_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{index + 1}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.product_name}
                      </div>
                      {item.inventory_applies && (
                        <div className="text-xs text-gray-500">
                          Inventory applies
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-gray-500">
                          Base: ${parseFloat(item.base_price).toFixed(2)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            Override:
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="None"
                            value={priceDrafts[item.product_id] ?? ""}
                            onChange={(e) =>
                              setPriceDrafts((prev) => ({
                                ...prev,
                                [item.product_id]: e.target.value,
                              }))
                            }
                            onBlur={() => commitPrice(item.product_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                            className="border rounded px-2 py-1 text-sm w-24"
                          />
                        </div>
                        {item.branch_price && (
                          <div className="text-xs font-semibold text-green-600">
                            Effective: ${parseFloat(item.price).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.inventory_applies ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">QOH:</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={qtyDrafts[item.product_id] ?? ""}
                              onChange={(e) =>
                                setQtyDrafts((prev) => ({
                                  ...prev,
                                  [item.product_id]: e.target.value,
                                }))
                              }
                              onBlur={() => commitQty(item.product_id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="border rounded px-2 py-1 text-sm w-24"
                              title="Quantity on hand for this branch. When it reaches 0, status becomes Unavailable Today automatically."
                            />
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {item.quantity_on_hand === null ? "Not set" : ""}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Unlimited</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          statusColors[item.status] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          updateProductStatus(item.product_id, e.target.value)
                        }
                        className="border rounded px-3 py-2 text-sm"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedBranch && !loading && filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No products found
          </div>
        )}
      </div>
    </div>
  );
}
