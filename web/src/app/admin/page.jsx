"use client";

import { useState, useEffect, useMemo } from "react";
import { PlusCircle, Upload, LogOut } from "lucide-react";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminActions } from "@/hooks/useAdminActions";
import { TabNavigation } from "@/components/Admin/TabNavigation";
import { DashboardView } from "@/components/Admin/DashboardView";
import { CategoryForm } from "@/components/Admin/CategoryForm";
import { BranchForm } from "@/components/Admin/BranchForm";
import { RewardForm } from "@/components/Admin/RewardForm";
import { AddPointsForm } from "@/components/Admin/AddPointsForm";
import { CategoriesTable } from "@/components/Admin/CategoriesTable";
import { ProductsTable } from "@/components/Admin/ProductsTable";
import { BranchesTable } from "@/components/Admin/BranchesTable";
import { ProductBranchStatusView } from "@/components/Admin/ProductBranchStatusView";
import { RewardsTable } from "@/components/Admin/RewardsTable";
import { LoyaltyView } from "@/components/Admin/LoyaltyView";
import { BulkUpload } from "@/components/Admin/BulkUpload";
import SettingsView from "@/components/Admin/SettingsView";
import UsersView from "@/components/Admin/UsersView";
import AdminUsersView from "@/components/Admin/AdminUsersView";
import OrdersView from "@/components/Admin/OrdersView";
import CustomizationItemsView from "@/components/Admin/CustomizationItemsView";
import { ProductFormModal } from "@/components/Admin/ProductFormModal";
import EventsView from "@/components/Admin/EventsView";
import LoyaltyPerksAdmin from "@/components/Admin/LoyaltyPerksAdmin";
import PromoCodesView from "@/components/Admin/PromoCodesView";
import NotificationsView from "@/components/Admin/NotificationsView";
import CustomerMessagesView from "@/components/Admin/CustomerMessagesView";
import WhatsAppInboxView from "@/components/Admin/WhatsAppInboxView";
import DeliveryPricingView from "@/components/Admin/DeliveryPricingView";
import WebsiteView from "@/components/Admin/WebsiteView";

export default function AdminPage() {
  const allTabs = useMemo(
    () => [
      "dashboard",
      "categories",
      "products",
      "customization-items",
      "branches",
      "delivery-pricing",
      "orders",
      "events",
      "notifications",
      "whatsapp-inbox",
      "customer-messages",
      "product-status",
      "rewards",
      "promo-codes",
      "loyalty",
      "clients",
      "admin-users",
      "website",
      "settings",
      "bulk-upload",
    ],
    [],
  );

  const getInitialTab = () => {
    if (typeof window === "undefined") {
      return "dashboard";
    }

    try {
      const raw = localStorage.getItem("admin_roles");
      const roles = raw ? JSON.parse(raw) : [];

      if (Array.isArray(roles) && roles.includes("backend")) {
        return "dashboard";
      }
      if (Array.isArray(roles) && roles.includes("orders")) {
        return "orders";
      }
      if (Array.isArray(roles) && roles.includes("product_status")) {
        return "product-status";
      }

      return "dashboard";
    } catch (e) {
      return "dashboard";
    }
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [allowedTabs, setAllowedTabs] = useState(null); // null = still loading

  const computeAllowedTabs = (roles) => {
    const roleList = Array.isArray(roles) ? roles : [];

    // Full access
    if (roleList.includes("backend")) {
      return allTabs;
    }

    const map = {
      orders: "orders",
      product_status: "product-status",
    };

    const tabsFromRoles = roleList.map((r) => map[r]).filter(Boolean);

    // If admin has "orders" role, automatically add "whatsapp-inbox"
    // (WhatsApp is used for order-related customer communication)
    if (
      roleList.includes("orders") &&
      !tabsFromRoles.includes("whatsapp-inbox")
    ) {
      tabsFromRoles.push("whatsapp-inbox");
    }

    // Ensure uniqueness and stable ordering
    const unique = Array.from(new Set(tabsFromRoles));

    // Keep ordering consistent with the main admin nav
    const ordered = allTabs.filter((t) => unique.includes(t));

    return ordered;
  };

  // Check admin authentication
  useEffect(() => {
    const checkAdminAuth = async () => {
      const adminEmail = localStorage.getItem("admin_email");
      const adminName = localStorage.getItem("admin_name");
      const adminId = localStorage.getItem("admin_id");
      const adminToken = localStorage.getItem("admin_token");

      if (!adminToken || !adminId) {
        // Not logged in - redirect to admin login
        window.location.href = "/admin/login";
        return;
      }

      // Try roles from localStorage first
      let roles = [];
      let branchId = null;
      let branchName = null;

      try {
        const raw = localStorage.getItem("admin_roles");
        roles = raw ? JSON.parse(raw) : [];
      } catch (e) {
        roles = [];
      }

      // Fetch full session from server (includes branch_id, branch_name, and roles)
      try {
        const res = await fetch("/api/admin-users/session", {
          headers: {
            "x-admin-token": adminToken,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const serverRoles = Array.isArray(data?.admin?.roles)
            ? data.admin.roles
            : [];
          roles = serverRoles;
          branchId = data?.admin?.branch_id || null;
          branchName = data?.admin?.branch_name || null;
          localStorage.setItem("admin_roles", JSON.stringify(serverRoles));
        }
      } catch (err) {
        console.error("Failed to fetch admin session:", err);
      }

      const nextAllowedTabs = computeAllowedTabs(roles);
      setAllowedTabs(nextAllowedTabs);

      setAdminUser({
        email: adminEmail || "",
        name: adminName || "Admin",
        roles,
        branch_id: branchId,
        branch_name: branchName,
      });

      // If the current tab isn't allowed, move them to the first allowed tab
      if (nextAllowedTabs.length > 0 && !nextAllowedTabs.includes(activeTab)) {
        setActiveTab(nextAllowedTabs[0]);
      }
    };

    checkAdminAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTabs]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_roles");
    window.location.href = "/admin/login";
  };

  // Initialize filters from localStorage
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_product_category_filter") || "all";
    }
    return "all";
  });

  const [selectedStatus, setSelectedStatus] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_product_status_filter") || "all";
    }
    return "all";
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_product_category_filter", selectedCategory);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_product_status_filter", selectedStatus);
    }
  }, [selectedStatus]);

  const {
    categories,
    products,
    branches,
    rewards,
    users,
    loyaltyTransactions,
    deliveryCost,
    branchBackgroundUrl,
    websiteIconUrl,
    orders,
    customizationItems,
    loading,
    fetchCategories,
    fetchProducts,
    fetchBranches,
    fetchRewards,
    fetchUsers,
    fetchLoyaltyTransactions,
    fetchDeliveryCost,
    fetchBranchBackground,
    fetchWebsiteIcon,
    fetchOrders,
    fetchCustomizationItems,
  } = useAdminData(activeTab);

  // Debug logging for products state
  console.log("AdminPage - Current activeTab:", activeTab);
  console.log("AdminPage - Products state:", products);
  console.log("AdminPage - Loading state:", loading);
  console.log("AdminPage - Products length:", products?.length);

  const {
    handleAddPoints,
    handleSaveCategory,
    handleSaveProduct: originalHandleSaveProduct,
    handleSaveBranch,
    handleSaveReward,
    handleDelete,
    handleUpdateDeliveryCost,
    handleUpdateBranchBackground,
    handleOrderStatusChange,
    handleOrderItemsUpdate,
    handleDeleteOrder,
  } = useAdminActions({
    fetchCategories,
    fetchProducts,
    fetchBranches,
    fetchRewards,
    fetchUsers,
    fetchLoyaltyTransactions,
    fetchDeliveryCost,
    fetchBranchBackground,
    fetchOrders,
  });

  const handleUpdateWebsiteIcon = (newUrl) => {
    fetchWebsiteIcon();
  };

  const handleEdit = (item) => {
    setEditingItem(item);

    // For products, use modal instead of form
    if (activeTab === "products") {
      setShowProductModal(true);
    } else {
      setShowForm(true);
    }
  };

  const handleBranchReorder = async (reorderedBranches) => {
    try {
      // Update local state immediately for responsive UI
      const updates = reorderedBranches.map((branch, index) => ({
        branchId: branch.id,
        sortOrder: index,
      }));

      // Call API to save new order
      const response = await fetch("/api/branches/sort-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update branch order");
      }

      // Refresh branches to get updated data
      await fetchBranches();
    } catch (error) {
      console.error("Error updating branch order:", error);
      alert("Failed to update branch order");
    }
  };

  const handleCategoryReorder = async (reorderedCategories) => {
    try {
      // Update local state immediately for responsive UI
      const updates = reorderedCategories.map((category, index) => ({
        categoryId: category.id,
        sortOrder: index,
      }));

      // Call API to save new order
      const response = await fetch("/api/categories/sort-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update category order");
      }

      // Refresh categories to get updated data
      await fetchCategories();
    } catch (error) {
      console.error("Error updating category order:", error);
      alert("Failed to update category order");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setShowProductModal(false);
    setEditingItem(null);
  };

  // Wrap the product save handler to close modal
  const handleSaveProductAndCloseModal = async (formData) => {
    const success = await originalHandleSaveProduct(formData);
    if (success) {
      setShowProductModal(false);
      setEditingItem(null);
    }
    return success;
  };

  // Don't render until admin check is complete
  if (!adminUser || allowedTabs === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If an admin has no tabs at all, show a friendly message
  if (allowedTabs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-xl font-bold text-gray-900">No admin access</h1>
            <p className="text-gray-600 mt-2">
              This admin account does not have any roles assigned.
            </p>
            <p className="text-gray-600 mt-2">
              Please ask a backend admin to grant you access.
            </p>
            <div className="mt-6">
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isBackendAdmin = Array.isArray(adminUser?.roles)
    ? adminUser.roles.includes("backend")
    : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Neo Beirut Admin
            </h1>
            <p className="text-gray-600 mt-1">
              Logged in as:{" "}
              <span className="font-medium">{adminUser.name}</span>
            </p>
          </div>
          <div className="flex gap-3">
            {isBackendAdmin ? (
              <>
                <a
                  href="/admin/logo"
                  className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-600 transition-colors"
                >
                  <Upload size={20} />
                  Upload Logo
                </a>
              </>
            ) : null}
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-600 transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>

        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={allowedTabs}
        />

        {/* Dashboard View */}
        {activeTab === "dashboard" && allowedTabs.includes("dashboard") && (
          <DashboardView onNavigate={setActiveTab} adminUser={adminUser} />
        )}

        {/* WhatsApp Inbox View */}
        {activeTab === "whatsapp-inbox" &&
          allowedTabs.includes("whatsapp-inbox") && (
            <WhatsAppInboxView
              adminToken={
                typeof window !== "undefined"
                  ? localStorage.getItem("admin_token")
                  : ""
              }
            />
          )}

        {/* Customer Messages View */}
        {activeTab === "customer-messages" &&
          allowedTabs.includes("customer-messages") && <CustomerMessagesView />}

        {/* Events View */}
        {activeTab === "events" && allowedTabs.includes("events") && (
          <EventsView />
        )}

        {/* Notifications View */}
        {activeTab === "notifications" &&
          allowedTabs.includes("notifications") && <NotificationsView />}

        {/* Promo Codes View */}
        {activeTab === "promo-codes" && allowedTabs.includes("promo-codes") && (
          <PromoCodesView />
        )}

        {/* Delivery Pricing View */}
        {activeTab === "delivery-pricing" &&
          allowedTabs.includes("delivery-pricing") && <DeliveryPricingView />}

        {/* Website View */}
        {activeTab === "website" && allowedTabs.includes("website") && (
          <WebsiteView />
        )}

        {/* Add New Button - Updated for products */}
        {activeTab !== "loyalty" &&
          activeTab !== "bulk-upload" &&
          activeTab !== "product-status" &&
          activeTab !== "delivery-pricing" &&
          activeTab !== "website" &&
          activeTab !== "settings" &&
          activeTab !== "clients" &&
          activeTab !== "admin-users" &&
          activeTab !== "orders" &&
          activeTab !== "customization-items" &&
          activeTab !== "dashboard" &&
          activeTab !== "events" &&
          activeTab !== "notifications" &&
          activeTab !== "promo-codes" && (
            <button
              onClick={() => {
                if (activeTab === "products") {
                  setShowProductModal(true);
                } else {
                  setShowForm(true);
                }
                setEditingItem(null);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 mb-6 hover:bg-blue-600"
            >
              <PlusCircle size={20} />
              Add New {activeTab.slice(0, -1)}
            </button>
          )}

        {/* Bulk Upload */}
        {activeTab === "bulk-upload" && (
          <BulkUpload
            onUploadComplete={() => {
              // Refresh data after successful upload
              fetchCategories();
              fetchProducts();
            }}
          />
        )}

        {/* Forms - Only show for non-products */}
        {showForm && activeTab === "categories" && (
          <CategoryForm
            editingItem={editingItem}
            onSave={handleSaveCategory}
            onCancel={handleCancelForm}
          />
        )}
        {showForm && activeTab === "branches" && (
          <BranchForm
            editingItem={editingItem}
            onSave={handleSaveBranch}
            onCancel={handleCancelForm}
          />
        )}
        {showForm && activeTab === "rewards" && (
          <RewardForm
            editingItem={editingItem}
            onSave={handleSaveReward}
            onCancel={handleCancelForm}
          />
        )}

        {/* Product Modal - Only for products */}
        {activeTab === "products" && (
          <ProductFormModal
            isOpen={showProductModal}
            editingItem={editingItem}
            categories={categories}
            products={products}
            onSave={handleSaveProductAndCloseModal}
            onClose={handleCancelForm}
          />
        )}

        {/* Customization Items View */}
        {activeTab === "customization-items" && (
          <CustomizationItemsView items={customizationItems} />
        )}

        {/* Product Branch Status View */}
        {activeTab === "product-status" &&
          allowedTabs.includes("product-status") && (
            <ProductBranchStatusView
              products={products}
              branches={branches}
              adminUser={adminUser}
            />
          )}

        {/* Loyalty Test Form */}
        {activeTab === "loyalty" && (
          <>
            <AddPointsForm users={users} onAddPoints={handleAddPoints} />
            <LoyaltyPerksAdmin users={users} />
          </>
        )}

        {/* Settings View */}
        {activeTab === "settings" && (
          <SettingsView
            deliveryCost={deliveryCost}
            branchBackgroundUrl={branchBackgroundUrl}
            websiteIconUrl={websiteIconUrl}
            onUpdateDeliveryCost={handleUpdateDeliveryCost}
            onUpdateBranchBackground={handleUpdateBranchBackground}
            onUpdateWebsiteIcon={handleUpdateWebsiteIcon}
          />
        )}

        {/* Clients View (previously Users) */}
        {activeTab === "clients" && <UsersView />}

        {/* Admin Users View */}
        {activeTab === "admin-users" && <AdminUsersView />}

        {/* Orders View */}
        {activeTab === "orders" && allowedTabs.includes("orders") && (
          <OrdersView
            orders={orders}
            onStatusChange={handleOrderStatusChange}
            onDelete={handleDeleteOrder}
            onUpdateItems={handleOrderItemsUpdate}
          />
        )}

        {/* Data Tables */}
        {allowedTabs.includes(activeTab) &&
          activeTab !== "bulk-upload" &&
          activeTab !== "product-status" &&
          activeTab !== "website" &&
          activeTab !== "settings" &&
          activeTab !== "clients" &&
          activeTab !== "admin-users" &&
          activeTab !== "orders" &&
          activeTab !== "dashboard" &&
          activeTab !== "events" &&
          activeTab !== "notifications" &&
          activeTab !== "promo-codes" &&
          activeTab !== "whatsapp-inbox" &&
          activeTab !== "customer-messages" &&
          (loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {activeTab === "loyalty" && (
                <LoyaltyView
                  users={users}
                  loyaltyTransactions={loyaltyTransactions}
                />
              )}

              {activeTab === "categories" && (
                <CategoriesTable
                  categories={categories}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReorder={handleCategoryReorder}
                />
              )}

              {activeTab === "products" && (
                <ProductsTable
                  products={products}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRefresh={fetchProducts}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedStatus={selectedStatus}
                  setSelectedStatus={setSelectedStatus}
                />
              )}

              {activeTab === "branches" && (
                <BranchesTable
                  branches={branches}
                  onEdit={handleEdit}
                  onDelete={(id) => handleDelete(id, "branches")}
                  onReorder={handleBranchReorder}
                />
              )}

              {activeTab === "rewards" && (
                <RewardsTable
                  rewards={rewards}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
