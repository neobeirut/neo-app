import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";
import { apiFetch } from "../utils/apiFetch";
import { useCartData } from "./useCartData";

export function useHomeData(
  selectedBranch,
  isAuthenticated = false,
  isReady = true,
) {
  // Fetch logo
  const logoQuery = useQuery({
    queryKey: ["logo"],
    queryFn: async () => {
      try {
        const response = await apiFetch("/api/logo");
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Failed to fetch logo (${response.status}) ${text}`);
        }
        return response.json();
      } catch (e) {
        console.error("[HOME-DATA] Logo fetch failed:", e);
        // In web preview, avoid hard crashes / reload loops.
        if (Platform.OS === "web") {
          return null;
        }
        throw e;
      }
    },
    retry: Platform.OS === "web" ? 0 : 1,
  });

  // Fetch products
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        const response = await apiFetch("/api/products");
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Failed to fetch products (${response.status}) ${text}`,
          );
        }
        return response.json();
      } catch (e) {
        console.error("[HOME-DATA] Products fetch failed:", e);

        // Additional diagnostics for web preview
        if (Platform.OS === "web") {
          console.error("[HOME-DATA] Web preview diagnostics:", {
            online:
              typeof navigator !== "undefined" ? navigator.onLine : "unknown",
            userAgent:
              typeof navigator !== "undefined"
                ? navigator.userAgent
                : "unknown",
            errorType: e.name,
            errorMessage: e.message,
          });

          // Return empty array to prevent app crash in web preview
          return { products: [] };
        }
        throw e;
      }
    },
    retry: Platform.OS === "web" ? 0 : 1,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
    refetchOnMount: true, // Refetch when component mounts
  });

  // Fetch product statuses for selected branch
  const productStatusQuery = useQuery({
    queryKey: ["product-status", selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) return null;

      try {
        const response = await apiFetch(
          `/api/product-branch-status?branch_id=${selectedBranch.id}`,
        );
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Failed to fetch product statuses (${response.status}) ${text}`,
          );
        }
        return response.json();
      } catch (e) {
        console.error("[HOME-DATA] Product status fetch failed:", e);
        if (Platform.OS === "web") {
          return { statuses: [] };
        }
        throw e;
      }
    },
    enabled: !!selectedBranch,
    retry: Platform.OS === "web" ? 0 : 1,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds for inventory updates
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
    refetchOnMount: true, // Refetch when component mounts
  });

  // Fetch categories (branch-aware: hide categories where all products are hidden for this branch)
  const categoriesQuery = useQuery({
    queryKey: ["categories", selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) {
        return { categories: [] };
      }

      try {
        const response = await apiFetch(
          `/api/categories?branch_id=${selectedBranch.id}`,
        );
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Failed to fetch categories (${response.status}) ${text}`,
          );
        }
        return response.json();
      } catch (e) {
        console.error("[HOME-DATA] Categories fetch failed:", e);
        if (Platform.OS === "web") {
          return { categories: [] };
        }
        throw e;
      }
    },
    enabled: !!selectedBranch,
    retry: Platform.OS === "web" ? 0 : 1,
  });

  // Fetch cart items using the app's single cart source of truth.
  // IMPORTANT: do not duplicate cart fetching logic in multiple hooks.
  // A weaker cart query elsewhere can overwrite the cache with an empty cart.
  const cartQuery = useCartData(selectedBranch, isAuthenticated, isReady);

  return {
    logoData: logoQuery.data,
    productsData: productsQuery.data,
    productsLoading: productsQuery.isLoading,
    productStatusData: productStatusQuery.data,
    statusLoading: productStatusQuery.isLoading,
    categoriesData: categoriesQuery.data,
    categoriesLoading: categoriesQuery.isLoading,
    cartData: cartQuery.data,
  };
}
