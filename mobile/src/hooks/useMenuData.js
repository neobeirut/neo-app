import { useQuery } from "@tanstack/react-query";
import { useCartData } from "./useCartData";
import { apiFetch } from "../utils/apiFetch";

export function useMenuData(
  selectedBranch,
  isAuthenticated = false,
  isReady = true,
) {
  // Fetch products
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      console.log("[MENU-DATA] 🍰 Fetching products...");
      console.log("[MENU-DATA] Base URL:", process.env.EXPO_PUBLIC_BASE_URL);

      try {
        const response = await apiFetch("/api/products");
        console.log("[MENU-DATA] Products response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "[MENU-DATA] ❌ Failed to fetch products:",
            response.status,
            errorText,
          );
          throw new Error(`Failed to fetch products: ${response.status}`);
        }

        const data = await response.json();
        console.log(
          "[MENU-DATA] ✅ Products count:",
          data.products?.length || 0,
        );
        return data;
      } catch (err) {
        console.error(
          "[MENU-DATA] ❌ Exception fetching products:",
          err.message,
        );
        throw err;
      }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds for real-time inventory
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
    refetchOnMount: true, // Refetch when component mounts
  });

  // Fetch product statuses for selected branch
  const {
    data: productStatusData,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ["product-status", selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) {
        console.log("[MENU-DATA] No branch selected for product status");
        return null;
      }

      console.log(
        "[MENU-DATA] 📊 Fetching product status for branch:",
        selectedBranch.id,
      );

      try {
        const response = await apiFetch(
          `/api/product-branch-status?branch_id=${selectedBranch.id}`,
        );
        console.log("[MENU-DATA] Product status response:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "[MENU-DATA] ❌ Failed to fetch product status:",
            errorText,
          );
          throw new Error("Failed to fetch product statuses");
        }

        const data = await response.json();
        console.log(
          "[MENU-DATA] ✅ Product status count:",
          data.statuses?.length || 0,
        );
        return data;
      } catch (err) {
        console.error(
          "[MENU-DATA] ❌ Exception fetching product status:",
          err.message,
        );
        throw err;
      }
    },
    enabled: !!selectedBranch,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds for inventory updates
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
    refetchOnMount: true, // Refetch when component mounts
  });

  // Fetch categories (branch-aware: hide categories where all products are hidden for this branch)
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery({
    queryKey: ["categories", selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) {
        return { categories: [] };
      }

      console.log("[MENU-DATA] 📁 Fetching categories...");

      try {
        const response = await apiFetch(
          `/api/categories?branch_id=${selectedBranch.id}`,
        );
        console.log("[MENU-DATA] Categories response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "[MENU-DATA] ❌ Failed to fetch categories:",
            errorText,
          );
          throw new Error("Failed to fetch categories");
        }

        const data = await response.json();
        console.log(
          "[MENU-DATA] ✅ Categories count:",
          data.categories?.length || 0,
        );
        return data;
      } catch (err) {
        console.error(
          "[MENU-DATA] ❌ Exception fetching categories:",
          err.message,
        );
        throw err;
      }
    },
    enabled: !!selectedBranch,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch cart items using the app's single cart source of truth.
  // Avoid duplicating cart fetching logic, which can overwrite the cache with an empty cart.
  const cartQuery = useCartData(selectedBranch, isAuthenticated, isReady);

  return {
    productsData,
    productsLoading,
    productsError,
    productStatusData,
    statusLoading,
    statusError,
    categoriesData,
    categoriesLoading,
    categoriesError,
    cartData: cartQuery.data,
    cartError: cartQuery.error,
  };
}
