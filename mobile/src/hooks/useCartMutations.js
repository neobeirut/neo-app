import { useRef, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { localCartStore } from "@/utils/localCartStore";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";

export function useCartMutations(selectedBranch, isAuthenticated) {
  const queryClient = useQueryClient();
  const pendingMutationsRef = useRef(new Set());
  const [isPendingMutation, setIsPendingMutation] = useState(false);

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cart_item_id, quantity }) => {
      const mutationId = `update-${cart_item_id}-${Date.now()}`;
      console.log(`[CART UPDATE] Starting mutation ${mutationId}`);

      if (pendingMutationsRef.current.size > 0) {
        console.log(
          `[CART UPDATE] ⚠️ Waiting for ${pendingMutationsRef.current.size} pending mutation(s)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      pendingMutationsRef.current.add(mutationId);
      setIsPendingMutation(true);

      try {
        // For anonymous users, use local storage
        if (!isAuthenticated) {
          console.log("[CART UPDATE] Anonymous user, updating local storage");
          await localCartStore.updateItem(
            selectedBranch.id,
            cart_item_id,
            quantity,
          );
          const localItems = await localCartStore.getCart(selectedBranch.id);
          return { cart_items: localItems };
        }

        const phone = await getAuthPhone();

        if (quantity < 1) {
          const params = new URLSearchParams({ id: cart_item_id });
          if (phone) params.append("phone", phone);

          const response = await apiFetch(`/api/cart?${params.toString()}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to remove item");
          }
          return response.json();
        }

        const requestBody = {
          cart_item_id,
          quantity,
          ...(phone ? { phone } : {}),
        };

        const response = await apiFetch("/api/cart/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update cart");
        }
        return response.json();
      } finally {
        pendingMutationsRef.current.delete(mutationId);
        if (pendingMutationsRef.current.size === 0) {
          setIsPendingMutation(false);
        }
        console.log(`[CART UPDATE] Completed mutation ${mutationId}`);
      }
    },
    onMutate: async ({ cart_item_id, quantity }) => {
      await queryClient.cancelQueries({
        queryKey: ["cart", selectedBranch?.id, isAuthenticated],
      });

      const previousCart = queryClient.getQueryData([
        "cart",
        selectedBranch?.id,
        isAuthenticated,
      ]);

      queryClient.setQueryData(
        ["cart", selectedBranch?.id, isAuthenticated],
        (old) => {
          if (!old?.cart_items) return old;

          if (quantity < 1) {
            return {
              ...old,
              cart_items: old.cart_items.filter(
                (item) => item.id !== cart_item_id,
              ),
            };
          }

          return {
            ...old,
            cart_items: old.cart_items.map((item) =>
              item.id === cart_item_id ? { ...item, quantity } : item,
            ),
          };
        },
      );

      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(
          ["cart", selectedBranch?.id, isAuthenticated],
          context.previousCart,
        );
      }
      Alert.alert("Error", "Failed to update cart");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async () => {
      if (isAuthenticated) {
        // For authenticated users, refetch from server
        setTimeout(async () => {
          await queryClient.refetchQueries({
            queryKey: ["cart", selectedBranch?.id, true],
            type: "active",
          });
        }, 400);
      } else {
        // For anonymous users, invalidate to re-read from local storage
        queryClient.invalidateQueries({
          queryKey: ["cart", selectedBranch?.id, false],
        });
      }
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (cartItemId) => {
      const mutationId = `delete-${cartItemId}-${Date.now()}`;
      console.log(`[CART DELETE] Starting mutation ${mutationId}`);

      if (pendingMutationsRef.current.size > 0) {
        console.log(
          `[CART DELETE] ⚠️ Waiting for ${pendingMutationsRef.current.size} pending mutation(s)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      pendingMutationsRef.current.add(mutationId);
      setIsPendingMutation(true);

      try {
        // For anonymous users, use local storage
        if (!isAuthenticated) {
          console.log(
            "[CART DELETE] Anonymous user, removing from local storage",
          );
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
        pendingMutationsRef.current.delete(mutationId);
        if (pendingMutationsRef.current.size === 0) {
          setIsPendingMutation(false);
        }
        console.log(`[CART DELETE] Completed mutation ${mutationId}`);
      }
    },
    onMutate: async (cartItemId) => {
      await queryClient.cancelQueries({
        queryKey: ["cart", selectedBranch?.id, isAuthenticated],
      });

      const previousCart = queryClient.getQueryData([
        "cart",
        selectedBranch?.id,
        isAuthenticated,
      ]);

      queryClient.setQueryData(
        ["cart", selectedBranch?.id, isAuthenticated],
        (old) => {
          if (!old?.cart_items) return old;
          return {
            ...old,
            cart_items: old.cart_items.filter((item) => item.id !== cartItemId),
          };
        },
      );

      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(
          ["cart", selectedBranch?.id, isAuthenticated],
          context.previousCart,
        );
      }
      Alert.alert("Error", err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isAuthenticated) {
        // For authenticated users, refetch from server
        setTimeout(async () => {
          await queryClient.refetchQueries({
            queryKey: ["cart", selectedBranch?.id, true],
            type: "active",
          });
        }, 400);
      } else {
        // For anonymous users, invalidate to re-read from local storage
        queryClient.invalidateQueries({
          queryKey: ["cart", selectedBranch?.id, false],
        });
      }
    },
  });

  const removeCustomizationMutation = useMutation({
    mutationFn: async ({ cartItemId, customizationId, cartData }) => {
      // For anonymous users, local storage doesn't support customization removal yet
      // This is a limitation that would need additional implementation
      if (!isAuthenticated) {
        throw new Error(
          "Customization removal not supported for anonymous users",
        );
      }

      const phone = await getAuthPhone();

      const currentCartItems = cartData?.cart_items || [];
      const cartItem = currentCartItems.find((item) => item.id === cartItemId);

      if (!cartItem) {
        throw new Error("Cart item not found");
      }

      const updatedCustomizations = (cartItem.customizations || []).filter(
        (c) => c.id !== customizationId,
      );

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
        throw new Error(errorData.error || "Failed to remove customization");
      }
      return response.json();
    },
    onMutate: async ({ cartItemId, customizationId }) => {
      await queryClient.cancelQueries({
        queryKey: ["cart", selectedBranch?.id, isAuthenticated],
      });

      const previousCart = queryClient.getQueryData([
        "cart",
        selectedBranch?.id,
        isAuthenticated,
      ]);

      queryClient.setQueryData(
        ["cart", selectedBranch?.id, isAuthenticated],
        (old) => {
          if (!old?.cart_items) return old;
          return {
            ...old,
            cart_items: old.cart_items.map((item) =>
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
        },
      );

      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(
          ["cart", selectedBranch?.id, isAuthenticated],
          context.previousCart,
        );
      }
      Alert.alert("Error", "Failed to remove customization");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(async () => {
        await queryClient.refetchQueries({
          queryKey: ["cart", selectedBranch?.id, isAuthenticated],
          type: "active",
        });
      }, 300);
    },
  });

  return {
    updateQuantityMutation,
    removeItemMutation,
    removeCustomizationMutation,
    isPendingMutation,
  };
}
