import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";
import { maybeShowNotificationPrePrompt } from "@/utils/notifications";

export function useOrderPlacement(selectedBranch, router) {
  const queryClient = useQueryClient();

  const orderMutation = useMutation({
    mutationFn: async (orderData) => {
      const phone = await getAuthPhone();
      const response = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orderData, phone }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        // Inventory failure (409)
        if (response.status === 409 && error?.code === "INSUFFICIENT_STOCK") {
          const first = error?.items?.[0];
          const message = first
            ? `Not enough stock for ${first.product_name || "an item"}. Available: ${first.available}. Requested: ${first.requested}.`
            : error.error || "Not enough stock";
          throw new Error(message);
        }

        // Loyalty failure (400)
        if (response.status === 400 && error?.code === "INSUFFICIENT_POINTS") {
          const required = Number(error?.required || 0);
          const current = Number(error?.current || 0);
          const message = `Not enough points to use this reward. You need ${required} points, but you have ${current}.`;
          throw new Error(message);
        }

        // Tier/perk reward failures
        if (
          response.status === 400 &&
          (error?.code === "USER_REWARD_EXPIRED" ||
            error?.code === "USER_REWARD_NOT_AVAILABLE" ||
            error?.code === "MULTIPLE_REWARDS_NOT_ALLOWED")
        ) {
          const message = error?.error || "This reward can’t be applied.";
          throw new Error(message);
        }

        // Delivery out-of-range for selected branch (400)
        if (
          response.status === 400 &&
          error?.code === "DELIVERY_NOT_AVAILABLE_FOR_BRANCH"
        ) {
          const message =
            error?.error ||
            "This address isn’t eligible for delivery from the selected branch.";

          const err = new Error(message);
          err.code = error.code;
          err.branch = error.branch || null;
          throw err;
        }

        throw new Error(error.error || "Failed to create order");
      }

      const data = await response.json().catch(() => null);

      // IMPORTANT: we only treat this as success if we got a real order id back.
      // If backend returned `null` (or empty body), do NOT clear the cart.
      if (!data || !data.order_id) {
        throw new Error(
          "Order response was empty. Please try again (your cart was not cleared).",
        );
      }

      return data;
    },
    onSuccess: async (data) => {
      // Safety: never clear cart unless we have a valid order id.
      if (!data?.order_id) {
        return;
      }

      const phone = await getAuthPhone();
      await apiFetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: selectedBranch.id,
          ...(phone ? { phone } : {}),
        }),
      }).catch(() => null);

      queryClient.invalidateQueries({
        queryKey: ["cart", selectedBranch?.id, true],
      });
      queryClient.invalidateQueries({ queryKey: ["loyalty"] });
      queryClient.invalidateQueries({ queryKey: ["user-orders"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Trigger A: after first successful order submission
      // Wait a beat so it feels like a follow-up to success (not a spammy interruption).
      setTimeout(() => {
        maybeShowNotificationPrePrompt("afterOrder").catch(() => null);
      }, 1200);

      return data;
    },
    onError: (error) => {
      // If the screen passes its own onError, it will still run.
      // Here we only show a generic alert for non-special cases.
      if (error?.code === "DELIVERY_NOT_AVAILABLE_FOR_BRANCH") {
        return;
      }
      Alert.alert("Order Failed", error.message);
    },
  });

  return orderMutation;
}
