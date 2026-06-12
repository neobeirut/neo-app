import { useState, useEffect } from "react";

export function useAdminData(activeTab) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [users, setUsers] = useState([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState([]);
  const [deliveryCost, setDeliveryCost] = useState(3.99);
  const [branchBackgroundUrl, setBranchBackgroundUrl] = useState(null);
  const [websiteIconUrl, setWebsiteIconUrl] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customizationItems, setCustomizationItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "dashboard") {
      const fetchDashboardData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            fetchOrders(true),
            fetchUsers(true),
            fetchProducts(true),
            fetchBranches(true),
          ]);
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchDashboardData();
    } else if (activeTab === "categories") {
      fetchCategories();
    } else if (activeTab === "products") {
      // Products view needs categories for the category filter + product form dropdown
      fetchCategories();
      fetchProducts();
    } else if (activeTab === "branches") {
      fetchBranches();
    } else if (activeTab === "product-status") {
      // Product status view needs products, branches, and categories (for product/category labels)
      fetchCategories();
      fetchProducts();
      fetchBranches();
    } else if (activeTab === "rewards") {
      fetchRewards();
    } else if (activeTab === "loyalty") {
      fetchUsers();
      fetchLoyaltyTransactions();
    } else if (activeTab === "settings") {
      fetchDeliveryCost();
      fetchBranchBackground();
      fetchWebsiteIcon();
    } else if (activeTab === "orders") {
      fetchOrders();
    } else if (activeTab === "customization-items") {
      fetchCustomizationItems();
    }
  }, [activeTab]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      // Admin should be able to see inactive categories too (otherwise the list can appear empty)
      const response = await fetch("/api/categories?include_inactive=true");

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to fetch categories (status ${response.status}) ${text}`,
        );
      }

      const data = await response.json();
      const nextCategories = Array.isArray(data.categories)
        ? data.categories
        : [];

      // Sort categories by section, display_order, and name (matching API ORDER BY)
      const sortedCategories = nextCategories.sort((a, b) => {
        // First sort by section
        const sectionA = a.section || "Store";
        const sectionB = b.section || "Store";
        if (sectionA !== sectionB) {
          return sectionA.localeCompare(sectionB);
        }

        // Then by display_order (nulls last)
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) {
          return orderA - orderB;
        }

        // Finally by name
        return (a.name || "").localeCompare(b.name || "");
      });

      setCategories(sortedCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setCategories([]);
    }
    setLoading(false);
  };

  const fetchProducts = async (silent = false) => {
    console.log("fetchProducts called - setting loading to true");
    if (!silent) setLoading(true);
    try {
      console.log("Fetching products from /api/products");
      const response = await fetch("/api/products");
      console.log("Product fetch response status:", response.status);
      console.log("Product fetch response ok:", response.ok);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Product fetch data:", data);
      console.log("Products from API:", data.products);
      console.log("Products array length:", data.products?.length);
      console.log("Products array type:", Array.isArray(data.products));

      // Ensure we have a valid products array
      const products = Array.isArray(data.products) ? data.products : [];
      setProducts(products);
      console.log("Products state updated with:", products.length, "items");
    } catch (error) {
      console.error("Error fetching products:", error);
      // Set an empty array on error to prevent undefined state
      setProducts([]);
    }
    console.log("fetchProducts finished - setting loading to false");
    if (!silent) setLoading(false);
  };

  const fetchBranches = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/branches");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Ensure branches is an array and sort by display_order
      const branchesArray = Array.isArray(data.branches) ? data.branches : [];
      // Sort by display_order (nulls last), then by name
      const sortedBranches = branchesArray.sort((a, b) => {
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || "").localeCompare(b.name || "");
      });
      setBranches(sortedBranches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      setBranches([]);
    }
    if (!silent) setLoading(false);
  };

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/rewards");
      const data = await response.json();
      setRewards(data.rewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
    }
    setLoading(false);
  };

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
    if (!silent) setLoading(false);
  };

  const fetchLoyaltyTransactions = async () => {
    try {
      const adminToken =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      const adminId =
        typeof window !== "undefined" ? localStorage.getItem("admin_id") : null;

      const headers =
        adminToken && adminId
          ? { "x-admin-token": adminToken, "x-admin-id": adminId }
          : {};

      const response = await fetch("/api/loyalty/transactions", { headers });
      if (response.ok) {
        const data = await response.json();
        setLoyaltyTransactions(data.transactions || []);
      } else {
        setLoyaltyTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching loyalty transactions:", error);
      setLoyaltyTransactions([]);
    }
  };

  const fetchDeliveryCost = async () => {
    try {
      const response = await fetch("/api/settings/delivery-cost");
      if (response.ok) {
        const data = await response.json();
        setDeliveryCost(data.delivery_cost);
      }
    } catch (error) {
      console.error("Error fetching delivery cost:", error);
    }
  };

  const fetchBranchBackground = async () => {
    try {
      const response = await fetch("/api/settings/branch-background");
      if (response.ok) {
        const data = await response.json();
        setBranchBackgroundUrl(data.url);
      }
    } catch (error) {
      console.error("Error fetching branch background:", error);
    }
  };

  const fetchWebsiteIcon = async () => {
    try {
      const response = await fetch("/api/settings/website-icon");
      if (response.ok) {
        const data = await response.json();
        setWebsiteIconUrl(data.url);
      }
    } catch (error) {
      console.error("Error fetching website icon:", error);
    }
  };

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const adminToken =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      const adminId =
        typeof window !== "undefined" ? localStorage.getItem("admin_id") : null;

      if (!adminToken || !adminId) {
        setOrders([]);
        if (!silent) setLoading(false);
        // If we are in the browser, redirect to admin login.
        if (typeof window !== "undefined") {
          window.location.href = "/admin/login";
        }
        return;
      }

      const headers = {
        "x-admin-token": adminToken,
        "x-admin-id": adminId, // dev fallback (ignored in prod)
      };

      const response = await fetch("/api/orders/admin", { headers });

      if (response.status === 401 || response.status === 403) {
        // Invalid/expired token or unauthorized role.
        localStorage.removeItem("admin_email");
        localStorage.removeItem("admin_name");
        localStorage.removeItem("admin_id");
        localStorage.removeItem("admin_token");
        alert("Admin session expired or unauthorized. Please sign in again.");
        setOrders([]);
        window.location.href = "/admin/login";
      } else if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        console.error("Failed to fetch orders:", response.status);
        setOrders([]);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
    }
    if (!silent) setLoading(false);
  };

  const fetchCustomizationItems = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customization-items");
      if (response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setCustomizationItems(data.items || []);
        } else {
          console.error("Expected JSON but got:", contentType);
          setCustomizationItems([]);
        }
      } else {
        console.error("Failed to fetch customization items:", response.status);
        setCustomizationItems([]);
      }
    } catch (error) {
      console.error("Error fetching customization items:", error);
      setCustomizationItems([]);
    }
    setLoading(false);
  };

  return {
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
  };
}
