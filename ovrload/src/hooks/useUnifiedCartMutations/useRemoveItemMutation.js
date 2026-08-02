import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { localCartStore } from "../../utils/localCartStore";
import { apiFetch } from "../../utils/apiFetch";
import { getAuthPhone } from "../../utils/auth/getAuthPhone";
import {
  cartKey,
  cartKeysForBranch,
  cartKeysForOptimisticUpdate,
} from "./cartKeyHelpers";
import { safeRefetch } from "./refetchHelpers";

export function useRemoveItemMutation({
  queryClient,
  selectedBranch,
  isAuth,
  acquireLock,
  releaseLock,
}) {
  return useMutation({
    mutationFn: async (cartItemId) => {
      const lockAcquired = await acquireLock("DELETE");
      if (!lockAcquired) {
        throw new Error("Another cart operation is in progress");
      }

      try {
        if (!selectedBranch?.id) {
          throw new Error("No branch selected");
        }

        // Anonymous users
        if (!isAuth) {
          await localCartStore.removeItem(selectedBranch.id, cartItemId);
          const localItems = await localCartStore.getCart(selectedBranch.id);
          return { cart_items: localItems };
        }

        const phone = await getAuthPhone();
        const params = new URLSearchParams({ id: cartItemId });
        if (phone) params.append("phone", phone);

        const response = await apiFetch(`/api/cart?${params.toString()}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to remove item");
        }

        return response.json();
      } finally {
        // lock released in onSuccess/onError
      }
    },
    onMutate: async (cartItemId) => {
      const branchId = selectedBranch?.id;

      // ✅ Only apply optimistic updates to the correct cache(s).
      const keys = cartKeysForOptimisticUpdate(branchId, isAuth);

      await Promise.all(
        keys.map((k) => queryClient.cancelQueries({ queryKey: k })),
      );

      const previousByKey = new Map();
      keys.forEach((k) => {
        previousByKey.set(JSON.stringify(k), queryClient.getQueryData(k));
      });

      const applyOptimistic = (old) => {
        const safeOld =
          old && typeof old === "object" ? old : { cart_items: [] };
        const existingItems = safeOld.cart_items || [];
        return {
          ...safeOld,
          cart_items: existingItems.filter((item) => item.id !== cartItemId),
        };
      };

      keys.forEach((k) => {
        queryClient.setQueryData(k, (old) => applyOptimistic(old));
      });

      return { previousByKey, keys };
    },
    onError: (err, variables, context) => {
      if (context?.previousByKey && context?.keys) {
        context.keys.forEach((k) => {
          const prev = context.previousByKey.get(JSON.stringify(k));
          if (prev !== undefined) {
            queryClient.setQueryData(k, prev);
          }
        });
      }
      releaseLock("DELETE");
      Alert.alert("Error", err.message || "Failed to remove item");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (selectedBranch?.id) {
        if (isAuth) {
          await safeRefetch(queryClient, selectedBranch.id, 250);
        } else {
          queryClient.invalidateQueries({
            queryKey: cartKey(selectedBranch.id, false),
          });
        }

        const keys = cartKeysForBranch(selectedBranch.id);
        keys.forEach((k) => {
          queryClient.invalidateQueries({ queryKey: k });
        });
      }

      releaseLock("DELETE");
    },
  });
}
