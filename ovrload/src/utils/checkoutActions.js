import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";
import { convertTo24Hour, formatAddress } from "@/utils/checkoutHelpers";
import { isTimeInWindow } from "@/utils/timeWindowHelpers";

export function createCheckoutActions({
  selectedBranch,
  queryClient,
  router,
  setShowAddressPicker,
}) {
  const clearBasketAndContinue = async () => {
    try {
      if (!selectedBranch?.id) {
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
        predicate: (q) =>
          q.queryKey?.[0] === "cart" && q.queryKey?.[1] === selectedBranch.id,
      });

      router.replace("/select-branch");
    } catch (e) {
      console.error("[checkout] Failed to clear basket:", e);
      Alert.alert("Error", "Could not clear your basket. Please try again.");
    }
  };

  const showOutOfBranchDeliveryAlert = () => {
    const branchName = selectedBranch?.name || "this branch";

    Alert.alert(
      "Delivery not available",
      `This address isn't eligible for delivery from ${branchName}.\n\nTo ensure correct pricing and availability, orders cannot be switched between branches.\nYour basket will be cleared if you continue.`,
      [
        {
          text: "Change address",
          style: "default",
          onPress: () => {
            if (setShowAddressPicker) {
              setShowAddressPicker(true);
            }
          },
        },
        {
          text: "Clear basket & continue",
          style: "destructive",
          onPress: () => {
            clearBasketAndContinue();
          },
        },
      ],
    );
  };

  return {
    clearBasketAndContinue,
    showOutOfBranchDeliveryAlert,
  };
}

export async function handlePlaceOrder({
  isAuthenticated,
  orderType,
  selectedAddressId,
  hasSelectedAddressCoords,
  isDeliverableForSelectedBranch,
  cartData,
  selectedBranch,
  selectedDate,
  selectedTime,
  selectedAddress,
  specialInstructions,
  selectedReward,
  selectedUserReward,
  appliedPromo,
  orderMutation,
  setRedirect,
  signIn,
  showOutOfBranchDeliveryAlert,
  setOrderPlaced,
  queryClient,
  router,
  formatDateTime,
  total,
}) {
  // ✅ CHECK 1: Branch orders must be active
  if (!selectedBranch?.orders_active) {
    Alert.alert(
      "Orders Temporarily Unavailable",
      `${selectedBranch?.name || "This branch"} is temporarily not accepting orders. Please try again later or select a different branch.`,
    );
    return;
  }

  // ✅ CHECK 2: Validate time window based on order type
  const isTimeValid =
    orderType === "delivery"
      ? isTimeInWindow(
          selectedTime,
          selectedBranch?.delivery_start_time,
          selectedBranch?.delivery_end_time,
          selectedDate,
        )
      : isTimeInWindow(
          selectedTime,
          selectedBranch?.opening_time,
          selectedBranch?.closing_time,
          selectedDate,
        );

  if (!isTimeValid) {
    const timeWindowText =
      orderType === "delivery"
        ? `${selectedBranch?.delivery_start_time || "11:00"} - ${selectedBranch?.delivery_end_time || "20:00"}`
        : `${selectedBranch?.opening_time || "09:00"} - ${selectedBranch?.closing_time || "21:00"}`;

    Alert.alert(
      "Invalid Time Selection",
      `${orderType === "delivery" ? "Delivery" : "Pickup"} is only available during ${timeWindowText}. Please select a valid time.`,
    );
    return;
  }

  if (!isAuthenticated) {
    setRedirect("/checkout");
    Alert.alert("Sign In Required", "Please sign in to place an order", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign In", onPress: () => signIn() },
    ]);
    return;
  }

  // Check if cart has items with status "Unavailable Today" and selected date is today
  if (cartData?.cart_items && cartData.cart_items.length > 0) {
    const unavailableTodayItems = cartData.cart_items.filter(
      (item) => item.status === "Unavailable Today",
    );

    if (unavailableTodayItems.length > 0) {
      // Check if selected date is today
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

      if (selectedDate === todayStr) {
        const itemNames = unavailableTodayItems
          .map((item) => `• ${item.name || "Unknown item"}`)
          .join("\n");

        Alert.alert(
          "Items Unavailable Today",
          `The following items are not available for today's orders:\n\n${itemNames}\n\nPlease select a different date or remove these items from your cart.`,
        );
        return;
      }
    }
  }

  if (orderType === "delivery") {
    if (!selectedAddressId) {
      Alert.alert(
        "Delivery Address Required",
        "Please select a delivery address",
      );
      return;
    }

    if (!hasSelectedAddressCoords) {
      Alert.alert(
        "Location Required",
        "This address is missing a Google Maps pin. Please edit the address and drop a pin.",
      );
      return;
    }

    if (isDeliverableForSelectedBranch === null) {
      Alert.alert(
        "Checking Delivery",
        "We're checking if this address is eligible for delivery from your selected branch. Please try again in a moment.",
      );
      return;
    }

    if (isDeliverableForSelectedBranch === false) {
      showOutOfBranchDeliveryAlert();
      return;
    }
  }

  if (!cartData?.cart_items || cartData.cart_items.length === 0) {
    Alert.alert("Empty Cart", "Your cart is empty");
    return;
  }

  if (!selectedBranch) {
    Alert.alert("Error", "No branch selected");
    return;
  }

  const timeIn24Hour = convertTo24Hour(selectedTime);

  const orderData = {
    branch_id: selectedBranch.id,
    items: cartData.cart_items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      selected_addons: item.addons?.map((a) => a.addon_id) || [],
      customizations: item.customizations || [],
      comment: item.comment || null,
    })),
    order_type: orderType,
    scheduled_date: selectedDate,
    scheduled_time: timeIn24Hour,
    delivery_address:
      orderType === "delivery" && selectedAddress
        ? formatAddress(selectedAddress)
        : "",
    address_id:
      orderType === "delivery" && selectedAddress ? selectedAddress.id : null,
    special_instructions: specialInstructions.trim(),
    ...(selectedReward?.id ? { applied_reward_id: selectedReward.id } : {}),
    ...(selectedUserReward?.id
      ? { applied_user_reward_id: selectedUserReward.id }
      : {}),
    ...(appliedPromo?.code ? { promo_code: appliedPromo.code } : {}),
  };

  orderMutation.mutate(orderData, {
    onSuccess: (data) => {
      if (!data || !data.order_id) {
        Alert.alert(
          "Order Issue",
          "We couldn't confirm your order id. Please check your Orders tab. If you don't see it, try again.",
        );
        return;
      }

      setOrderPlaced(true);
      queryClient.invalidateQueries({ queryKey: ["user-orders"] });

      const totalText =
        data?.total_amount !== null && data?.total_amount !== undefined
          ? `$${Number(data.total_amount).toFixed(2)}`
          : `$${total.toFixed(2)}`;

      const rewardLine = selectedUserReward
        ? `\nReward attached: ${selectedUserReward.title}`
        : selectedReward
          ? `\nReward applied: ${selectedReward.title}`
          : "";

      Alert.alert(
        "Order Placed! 🎉",
        `Your order #${data.order_id} has been confirmed!\n\nTotal: ${totalText}${rewardLine}\nScheduled for: ${formatDateTime()}\n\nPoints are earned when your order is completed.`,
        [
          {
            text: "View Orders",
            onPress: () => router.replace("/order-history"),
          },
          {
            text: "Continue Shopping",
            onPress: () => router.replace("/(tabs)/home"),
          },
        ],
      );
    },
    onError: (err) => {
      if (err?.code === "DELIVERY_NOT_AVAILABLE_FOR_BRANCH") {
        showOutOfBranchDeliveryAlert();
        return;
      }
      Alert.alert("Order Failed", err?.message || "Failed to create order");
    },
  });
}

export async function handlePromoCodeApply({
  promoCodeInput,
  selectedBranch,
  promoValidateMutation,
  setAppliedPromo,
  setPromoError,
}) {
  try {
    await Haptics.selectionAsync();
    setPromoError(null);

    const branchId = selectedBranch?.id;
    if (!branchId) {
      setPromoError("Please select a branch first.");
      return;
    }

    const code = promoCodeInput.trim().toUpperCase();
    const data = await promoValidateMutation.mutateAsync({
      code,
      branchId,
    });

    setAppliedPromo({
      code: data?.code || code,
      discount_amount: data?.discount_amount || 0,
      description: data?.description || null,
    });
  } catch (e) {
    console.error(e);
    setAppliedPromo(null);
    setPromoError(String(e?.message || "Promo code could not be applied"));
  }
}
