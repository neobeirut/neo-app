import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";

export function useOrderHistory() {
  const queryClient = useQueryClient();

  const {
    data: ordersData,
    isLoading,
    refetch,
    isRefetching,
    error,
  } = useQuery({
    queryKey: ["user-orders"],
    queryFn: async () => {
      const phone = await getAuthPhone();
      const url = phone
        ? `/api/orders?phone=${encodeURIComponent(phone)}`
        : "/api/orders";

      const response = await apiFetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch orders");
      }
      return response.json();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ order, selectedBranch }) => {
      const phone = await getAuthPhone();
      const items = order.items || [];

      for (const item of items) {
        const response = await apiFetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: item.product_id,
            quantity: item.quantity,
            branch_id: selectedBranch?.id || order.branch_id,
            ...(phone ? { phone } : {}),
            customizations: item.customizations || [],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to add item to cart");
        }
      }

      return { success: true };
    },
    onSuccess: (_, { onSuccess }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to reorder");
    },
  });

  return {
    orders: ordersData?.orders || [],
    isLoading,
    refetch,
    isRefetching,
    error,
    reorderMutation,
  };
}
