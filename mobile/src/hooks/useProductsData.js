import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";

export function useProductsData(enabled = true) {
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await apiFetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds for real-time inventory
    refetchOnWindowFocus: true, // Refetch when user returns to app
    refetchOnMount: true, // Refetch when component mounts
  });

  return { productsData };
}
