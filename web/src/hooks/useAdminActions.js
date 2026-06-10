export function useAdminActions(fetchCallbacks) {
  const getAdminHeaders = () => {
    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");

      if (!adminToken || !adminId) {
        return {};
      }

      return {
        "x-admin-token": adminToken,
        "x-admin-id": adminId, // dev fallback only
      };
    } catch (e) {
      // SSR/edge case: localStorage not available
      return {};
    }
  };

  const handleAddPoints = async (userId, points, description) => {
    try {
      const response = await fetch("/api/loyalty/points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          userId: userId,
          points: parseInt(points),
          description: description,
          transaction_type: "earned",
        }),
      });

      if (response.ok) {
        alert(`Successfully added ${points} points!`);
        fetchCallbacks.fetchUsers();
        fetchCallbacks.fetchLoyaltyTransactions();
      } else {
        const error = await response.json().catch(() => ({}));
        alert(error.error || "Failed to add points");
      }
    } catch (error) {
      console.error("Error adding points:", error);
      alert("Error adding points");
    }
  };

  const handleSaveCategory = async (categoryData) => {
    try {
      const url = categoryData.id
        ? `/api/categories/${categoryData.id}`
        : "/api/categories";
      const method = categoryData.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryData),
      });

      if (response.ok) {
        fetchCallbacks.fetchCategories();
        alert(
          `Category ${categoryData.id ? "updated" : "created"} successfully!`,
        );
        return true;
      } else {
        const error = await response.json();
        alert(`Failed to save category: ${error.error || "Unknown error"}`);
        return false;
      }
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Error saving category");
      return false;
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      const url = productData.id
        ? `/api/products/${productData.id}`
        : "/api/products";
      const method = productData.id ? "PUT" : "POST";

      console.log("[ADMIN] Saving product:", productData);
      console.log("[ADMIN] URL:", url, "Method:", method);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      console.log("[ADMIN] Response status:", response.status);
      console.log("[ADMIN] Response ok:", response.ok);

      const responseData = await response.json();
      console.log("[ADMIN] Response data:", responseData);

      if (response.ok) {
        console.log("[ADMIN] ✅ Product saved successfully");

        // Refresh immediately since database operation is complete
        console.log("[ADMIN] Refreshing product list...");
        await fetchCallbacks.fetchProducts();
        console.log("[ADMIN] Product list refreshed");

        alert(
          `✅ Product ${productData.id ? "updated" : "created"} successfully!`,
        );

        return true;
      } else {
        console.error("[ADMIN] ❌ Product save failed:", responseData);
        const errorMessage = responseData.error || "Unknown error";
        alert(`❌ Failed to save product: ${errorMessage}`);
        return false;
      }
    } catch (error) {
      console.error("[ADMIN] ❌ Error saving product:", error);
      alert(
        `❌ Error saving product: ${error.message}. Check console for details.`,
      );
      return false;
    }
  };

  const handleSaveBranch = async (branchData) => {
    try {
      const url = branchData.id
        ? `/api/branches/${branchData.id}`
        : "/api/branches";
      const method = branchData.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchData),
      });

      if (response.ok) {
        fetchCallbacks.fetchBranches();
        alert(`Branch ${branchData.id ? "updated" : "created"} successfully!`);
        return true;
      } else {
        const error = await response.json();
        alert(`Failed to save branch: ${error.error || "Unknown error"}`);
        return false;
      }
    } catch (error) {
      console.error("Error saving branch:", error);
      alert("Error saving branch");
      return false;
    }
  };

  const handleSaveReward = async (rewardData) => {
    try {
      const url = rewardData.id
        ? `/api/rewards/${rewardData.id}`
        : "/api/rewards";
      const method = rewardData.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify(rewardData),
      });

      if (response.ok) {
        fetchCallbacks.fetchRewards();
        alert(`Reward ${rewardData.id ? "updated" : "created"} successfully!`);
        return true;
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`Failed to save reward: ${error.error || "Unknown error"}`);
        return false;
      }
    } catch (error) {
      console.error("Error saving reward:", error);
      alert("Error saving reward");
      return false;
    }
  };

  const handleDelete = async (id, type) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const headers = type === "rewards" ? getAdminHeaders() : {};

      const response = await fetch(`/api/${type}/${id}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        alert(`${type.slice(0, -1)} deleted successfully!`);
        if (type === "categories") fetchCallbacks.fetchCategories();
        else if (type === "products") fetchCallbacks.fetchProducts();
        else if (type === "branches") fetchCallbacks.fetchBranches();
        else if (type === "rewards") fetchCallbacks.fetchRewards();
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`Failed to delete: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Error deleting item");
    }
  };

  const handleUpdateDeliveryCost = async (cost) => {
    try {
      const response = await fetch("/api/settings/delivery-cost", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ delivery_cost: cost }),
      });

      if (!response.ok) {
        // prefer server-provided message if available
        let errorMessage = `Failed to update delivery cost (status ${response.status})`;
        try {
          const error = await response.json();
          if (error?.error) {
            errorMessage = `Failed to update delivery cost: ${error.error}`;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errorMessage);
      }

      if (fetchCallbacks.fetchDeliveryCost) {
        fetchCallbacks.fetchDeliveryCost();
      }
      return true;
    } catch (error) {
      console.error("Error updating delivery cost:", error);
      throw error;
    }
  };

  const handleOrderStatusChange = async (orderId, status) => {
    try {
      const response = await fetch(`/api/orders/admin/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (fetchCallbacks.fetchOrders) {
          fetchCallbacks.fetchOrders();
        }
        // Return the full response data including WhatsApp results
        return data;
      } else {
        alert(`Failed to update status: ${data.error || "Unknown error"}`);
        return null;
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("Error updating order status");
      return null;
    }
  };

  const handleOrderItemsUpdate = async (orderId, items) => {
    try {
      const response = await fetch(`/api/orders/admin/${orderId}/items`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ items }),
      });

      if (response.ok) {
        if (fetchCallbacks.fetchOrders) {
          fetchCallbacks.fetchOrders();
        }
        return true;
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`Failed to update items: ${error.error || "Unknown error"}`);
        return false;
      }
    } catch (error) {
      console.error("Error updating order items:", error);
      alert("Error updating order items");
      return false;
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      const response = await fetch(`/api/orders/admin/${orderId}`, {
        method: "DELETE",
        headers: {
          ...getAdminHeaders(),
        },
      });

      if (response.ok) {
        alert("Order deleted successfully!");
        if (fetchCallbacks.fetchOrders) {
          fetchCallbacks.fetchOrders();
        }
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`Failed to delete order: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("Error deleting order");
    }
  };

  const handleUpdateBranchBackground = async (url) => {
    try {
      const response = await fetch("/api/settings/branch-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to update branch background (status ${response.status})`;
        try {
          const error = await response.json();
          if (error?.error) {
            errorMessage = `Failed to update branch background: ${error.error}`;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errorMessage);
      }

      if (fetchCallbacks.fetchBranchBackground) {
        fetchCallbacks.fetchBranchBackground();
      }
      return true;
    } catch (error) {
      console.error("Error updating branch background:", error);
      throw error;
    }
  };

  return {
    handleAddPoints,
    handleSaveCategory,
    handleSaveProduct,
    handleSaveBranch,
    handleSaveReward,
    handleDelete,
    handleUpdateDeliveryCost,
    handleUpdateBranchBackground,
    handleOrderStatusChange,
    handleOrderItemsUpdate,
    handleDeleteOrder,
  };
}
