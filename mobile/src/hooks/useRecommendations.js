import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";

export function useRecommendations({
  selectedBranch,
  currentProduct,
  currentProductId: currentProductIdProp,
  cartData,
  maxSuggestions = 4,
  enabled = true,
}) {
  const branchId = selectedBranch?.id ? Number(selectedBranch.id) : null;
  const currentProductId = currentProductIdProp
    ? Number(currentProductIdProp)
    : currentProduct?.id
      ? Number(currentProduct.id)
      : null;

  const cartProductIds = useMemo(() => {
    const items = cartData?.cart_items || [];
    const ids = items
      .map((i) => Number(i.product_id))
      .filter((v) => Number.isFinite(v));
    return Array.from(new Set(ids));
  }, [cartData]);

  const queryEnabled =
    !!enabled &&
    !!branchId &&
    !!currentProductId &&
    Number.isFinite(maxSuggestions) &&
    maxSuggestions > 0;

  return useQuery({
    queryKey: [
      "recommendations",
      branchId,
      currentProductId,
      cartProductIds.join(","),
      Number(maxSuggestions),
    ],
    enabled: queryEnabled,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const response = await apiFetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          current_product_id: currentProductId,
          cart_product_ids: cartProductIds,
          max_suggestions: maxSuggestions,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `When fetching /api/recommendations, the response was [${response.status}] ${response.statusText} ${text}`,
        );
      }

      return response.json();
    },
    select: (data) => data?.recommendations || [],
  });
}
