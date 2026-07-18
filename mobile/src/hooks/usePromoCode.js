import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";

export function usePromoCode() {
  const promoValidateMutation = useMutation({
    mutationFn: async ({ code, branchId }) => {
      const response = await apiFetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          branch_id: branchId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Invalid promo code");
      }

      return response.json();
    },
  });

  return { promoValidateMutation };
}
