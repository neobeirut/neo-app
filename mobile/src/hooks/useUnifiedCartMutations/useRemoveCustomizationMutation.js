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

export function useRemoveCustomizationMutation({
  queryClient,
  selectedBranch,
  isAuth,
  acquireLock,
  releaseLock,
}) {
  return useMutation({
    mutationFn: async ({ cartItemId, customizationId, cartData }) => {
      const lockAcquired = await acquireLock("REMOVE_CUSTOM");
      if (!lockAcquired) {
        throw new Error("Another cart operation is in progress");
      }

      try {
        if (!selectedBranch?.id) {
          throw new Error("No branch selected");
        }

        const currentCartItems = cartData?.cart_items || [];
        const cartItem = currentCartItems.find(
          (item) => item.id === cartItemId,
        );

        if (!cartItem) {
          throw new Error("Cart item not found");
        }

        // Check if this is a product add-on (prefixed with "addon_")
        const isProductAddon = String(customizationId).startsWith("addon_");

        if (isProductAddon) {
          // Handle product add-on removal
          const addonIdStr = String(customizationId).replace("addon_", "");
          const addonId = Number(addonIdStr);

          const currentAddons = Array.isArray(cartItem.addons)
            ? cartItem.addons
            : [];

          const updatedAddons = currentAddons.filter((a) => {
            const id = a?.addon_id || a?.id;
            return Number(id) !== addonId;
          });

          // Get the IDs to send to the API
          const selectedAddonIds = updatedAddons.map((a) =>
            Number(a?.addon_id || a?.id),
          );

          // Anonymous users -> local storage
          if (!isAuth) {
            await localCartStore.updateItemDetails(
              selectedBranch.id,
              cartItemId,
              {
                addons: updatedAddons,
              },
            );

            const localItems = await localCartStore.getCart(selectedBranch.id);
            return { cart_items: localItems };
          }

          // Signed-in users -> server
          const phone = await getAuthPhone();

          const requestBody = {
            cart_item_id: cartItemId,
            selected_addons: selectedAddonIds,
            ...(phone ? { phone } : {}),
          };

          const response = await apiFetch("/api/cart/update", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to remove add-on");
          }

          return response.json();
        } else {
          // Handle regular customization removal
          const updatedCustomizations = (cartItem.customizations || []).filter(
            (c) => c.id !== customizationId,
          );

          // Anonymous users -> local storage
          if (!isAuth) {
            await localCartStore.updateItemDetails(
              selectedBranch.id,
              cartItemId,
              {
                customizations: updatedCustomizations,
              },
            );

            const localItems = await localCartStore.getCart(selectedBranch.id);
            return { cart_items: localItems };
          }

          // Signed-in users -> server
          const phone = await getAuthPhone();

          const requestBody = {
            cart_item_id: cartItemId,
            customizations: updatedCustomizations,
            ...(phone ? { phone } : {}),
          };

          const response = await apiFetch("/api/cart/update", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error || "Failed to remove customization",
            );
          }

          return response.json();
        }
      } finally {
        // lock released in onSuccess/onError
      }
    },
    onMutate: async ({ cartItemId, customizationId }) => {
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

      const isProductAddon = String(customizationId).startsWith("addon_");

      const applyOptimistic = (old) => {
        const safeOld =
          old && typeof old === "object" ? old : { cart_items: [] };
        const existingItems = safeOld.cart_items || [];

        if (isProductAddon) {
          // Remove product add-on optimistically
          const addonIdStr = String(customizationId).replace("addon_", "");
          const addonId = Number(addonIdStr);

          return {
            ...safeOld,
            cart_items: existingItems.map((item) => {
              if (item.id !== cartItemId) return item;

              const updatedAddons = (item.addons || []).filter((a) => {
                const id = a?.addon_id || a?.id;
                return Number(id) !== addonId;
              });

              return { ...item, addons: updatedAddons };
            }),
          };
        } else {
          // Remove regular customization optimistically
          return {
            ...safeOld,
            cart_items: existingItems.map((item) =>
              item.id === cartItemId
                ? {
                    ...item,
                    customizations: (item.customizations || []).filter(
                      (c) => c.id !== customizationId,
                    ),
                  }
                : item,
            ),
          };
        }
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
      releaseLock("REMOVE_CUSTOM");
      Alert.alert("Error", err.message || "Failed to update cart");
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

      releaseLock("REMOVE_CUSTOM");
    },
  });
}
