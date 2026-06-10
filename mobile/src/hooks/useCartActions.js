import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { phoneAuth } from "@/utils/auth/phoneAuth";
import { localCartStore } from "@/utils/localCartStore";
import { serverCartBackupStore } from "@/utils/serverCartBackupStore";
import { apiFetch } from "@/utils/apiFetch";

async function safeSelectionHaptic() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.selectionAsync();
  } catch (e) {
    // ignore haptics failures (common on web preview)
  }
}

async function safeImpactLight() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    // ignore
  }
}

async function safeNotifySuccess() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {
    // ignore
  }
}

export function useCartActions(
  selectedBranch,
  setSelectedBranch,
  router,
  isAuthenticated,
  isReady,
  isMutating,
) {
  const queryClient = useQueryClient();

  const handleCloseCart = async () => {
    await safeSelectionHaptic();
    router.push("/(tabs)/home");
  };

  const handleCheckout = async (cartData) => {
    // Important: in web preview, expo-haptics can throw and block navigation.
    console.log("[CART] Checkout pressed");

    if (!cartData?.cart_items || cartData.cart_items.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart first");
      return;
    }

    await safeNotifySuccess();

    // Navigate even if haptics fail
    try {
      router.push("/checkout");
    } catch (e) {
      console.error("[CART] router.push(/checkout) failed:", e);
    }
  };

  const handleMenuPress = async (setMenuVisible) => {
    await safeSelectionHaptic();
    setMenuVisible(true);
  };

  const handleChangeLocation = async (cartData) => {
    const hasItems = cartData?.cart_items && cartData.cart_items.length > 0;

    if (hasItems) {
      Alert.alert(
        "Clear Cart?",
        "Changing locations will clear your current cart. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            style: "destructive",
            onPress: async () => {
              try {
                if (!selectedBranch?.id) {
                  setSelectedBranch(null);
                  router.push("/select-branch");
                  return;
                }

                if (!isAuthenticated) {
                  await localCartStore.clearCart(selectedBranch.id);
                  await queryClient.invalidateQueries({
                    queryKey: ["cart", selectedBranch.id, false],
                  });
                  setSelectedBranch(null);
                  router.push("/select-branch");
                  return;
                }

                const phone = await phoneAuth.getUserPhone();
                const requestBody = { branch_id: selectedBranch.id, phone };

                const response = await apiFetch("/api/cart/clear", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                  throw new Error("Failed to clear cart");
                }

                // Keep signed-in backup cart consistent with server clears
                try {
                  await serverCartBackupStore.clearCart(selectedBranch.id);
                } catch (e) {
                  // ignore backup failures
                }

                await queryClient.invalidateQueries({
                  queryKey: ["cart", selectedBranch.id, true],
                });
                setSelectedBranch(null);
                router.push("/select-branch");
              } catch (error) {
                console.error("Error clearing cart:", error);
                Alert.alert("Error", "Failed to clear cart");
              }
            },
          },
        ],
      );
    } else {
      setSelectedBranch(null);
      router.push("/select-branch");
    }
  };

  const updateQuantity = async (
    cartItemId,
    newQuantity,
    updateQuantityMutation,
  ) => {
    // IMPORTANT: isMutating is now reserved for destructive operations (add/remove/customization).
    // Quantity changes should feel instant; react-query onMutate handles the UI update.
    if (isMutating) {
      console.log(
        "[CART] ⚠️ Ignoring update request - destructive mutation in progress",
      );
      return;
    }

    // Don't block the UI on haptics (awaiting can make +/- feel laggy)
    safeImpactLight();

    updateQuantityMutation.mutate({
      cart_item_id: cartItemId,
      quantity: newQuantity,
    });
  };

  const removeItem = async (cartItemId, removeItemMutation) => {
    if (isMutating) {
      console.log("[CART] ⚠️ Ignoring delete request - mutation in progress");
      return;
    }

    safeImpactLight();
    removeItemMutation.mutate(cartItemId);
  };

  const removeCustomization = async (
    cartItemId,
    customizationId,
    removeCustomizationMutation,
    cartData,
  ) => {
    if (isMutating) {
      console.log(
        "[CART] ⚠️ Ignoring customization remove request - mutation in progress",
      );
      return;
    }

    safeImpactLight();
    removeCustomizationMutation.mutate({
      cartItemId,
      customizationId,
      cartData,
    });
  };

  return {
    handleCloseCart,
    handleCheckout,
    handleMenuPress,
    handleChangeLocation,
    updateQuantity,
    removeItem,
    removeCustomization,
  };
}
