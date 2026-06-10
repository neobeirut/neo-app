import { Alert, Platform } from "react-native";
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

export function useUpdateQuantityMutation({
  queryClient,
  selectedBranch,
  isAuthenticated,
  isAuth,
  isLocked,
}) {
  const safeNotify = (type) => {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(type).catch(() => {});
  };

  return useMutation({
    mutationFn: async ({ cart_item_id, quantity }) => {
      console.log("[UPDATE_QUANTITY] Starting mutation");
      console.log("[UPDATE_QUANTITY] Params:", { cart_item_id, quantity });

      if (!selectedBranch?.id) {
        throw new Error("No branch selected");
      }

      if (isLocked()) {
        throw new Error("Another cart operation is in progress");
      }

      // Anonymous users
      if (!isAuthenticated) {
        console.log("[UPDATE_QUANTITY] Anonymous user - using local storage");
        await localCartStore.updateItem(
          selectedBranch.id,
          cart_item_id,
          quantity,
        );
        const localItems = await localCartStore.getCart(selectedBranch.id);
        console.log("[UPDATE_QUANTITY] ✅ Local storage update successful");
        return { cart_items: localItems };
      }

      console.log("[UPDATE_QUANTITY] Authenticated user - calling API");
      const phone = await getAuthPhone();
      console.log("[UPDATE_QUANTITY] Phone:", phone ? "Present" : "Missing");

      // If quantity is 0, delete the item
      if (quantity < 1) {
        console.log("[UPDATE_QUANTITY] Quantity < 1, deleting item");
        const params = new URLSearchParams({ id: cart_item_id });
        if (phone) params.append("phone", phone);

        const response = await apiFetch(`/api/cart?${params.toString()}`, {
          method: "DELETE",
        });

        console.log(
          "[UPDATE_QUANTITY] Delete response status:",
          response.status,
          response.ok ? "OK" : "ERROR",
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            "[UPDATE_QUANTITY] ❌ Delete error response:",
            errorData,
          );
          throw new Error(errorData.error || "Failed to remove item");
        }

        const result = await response.json();
        console.log("[UPDATE_QUANTITY] ✅ Delete successful");
        return result;
      }

      const requestBody = {
        cart_item_id,
        quantity,
        ...(phone ? { phone } : {}),
      };

      console.log("[UPDATE_QUANTITY] Request body:", requestBody);

      const response = await apiFetch("/api/cart/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log(
        "[UPDATE_QUANTITY] Response status:",
        response.status,
        response.ok ? "OK" : "ERROR",
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error("[UPDATE_QUANTITY] ❌ Error response:", errorData);
        } catch (e) {
          console.error("[UPDATE_QUANTITY] ❌ Failed to parse error response");
          errorData = {};
        }

        const errorMessage =
          errorData.error ||
          `Failed to update cart (status ${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("[UPDATE_QUANTITY] ✅ Success:", result);
      return result;
    },
    onMutate: async ({ cart_item_id, quantity }) => {
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

        let newItems;
        if (quantity < 1) {
          newItems = existingItems.filter((item) => item.id !== cart_item_id);
        } else {
          newItems = existingItems.map((item) =>
            item.id === cart_item_id ? { ...item, quantity } : item,
          );
        }

        return { ...safeOld, cart_items: newItems };
      };

      keys.forEach((k) => {
        queryClient.setQueryData(k, (old) => applyOptimistic(old));
      });

      return { previousByKey, keys, branchId };
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

      Alert.alert("Error", err.message || "Failed to update cart");
      safeNotify(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async () => {
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

      safeNotify(Haptics.NotificationFeedbackType.Success);
    },
  });
}
