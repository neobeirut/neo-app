export function calculateCheckoutTotals({
  cartData,
  orderType,
  deliveryCostData,
  selectedReward,
  appliedPromo,
}) {
  const calculateSubtotal = (data) => {
    if (!data?.cart_items) return 0;

    return data.cart_items.reduce((total, item) => {
      const basePrice = Number.parseFloat(item.price || 0);

      const addonsTotal = (item.addons || []).reduce(
        (addonSum, addon) => addonSum + Number.parseFloat(addon.price || 0),
        0,
      );

      const customizationsTotal = (item.customizations || []).reduce(
        (sum, customization) => {
          const type = customization?.customization_type || customization?.type;
          // Include BOTH addon and option type customizations in pricing
          const isPriced = type === "addon" || type === "option";
          if (!isPriced) {
            return sum;
          }
          return sum + Number.parseFloat(customization.price || 0);
        },
        0,
      );

      const qty = Number(item.quantity || 1);
      const line = (basePrice + addonsTotal + customizationsTotal) * qty;

      return total + (Number.isFinite(line) ? line : 0);
    }, 0);
  };

  // Fix: Use nullish coalescing (??) instead of OR (||)
  // This allows legitimate $0 delivery costs to work correctly
  // Only fall back to 5 if deliveryCost is null or undefined, not if it's 0
  const baseDeliveryCost =
    orderType === "delivery" ? (deliveryCostData?.deliveryCost ?? 5) : 0;

  const subtotal = calculateSubtotal(cartData);

  const rewardDiscount = selectedReward
    ? Math.max(Number.parseFloat(selectedReward.discount_amount || 0) || 0, 0)
    : 0;

  const appliedRewardDiscount = selectedReward
    ? Math.min(subtotal, rewardDiscount)
    : 0;

  const promoDiscountRaw = appliedPromo?.discount_amount;
  const promoDiscount = promoDiscountRaw
    ? Math.max(Number.parseFloat(promoDiscountRaw) || 0, 0)
    : 0;

  const deliveryCost =
    selectedReward && selectedReward.free_delivery === true
      ? 0
      : baseDeliveryCost;

  const total = Math.max(
    subtotal + deliveryCost - appliedRewardDiscount - promoDiscount,
    0,
  );

  return {
    subtotal,
    deliveryCost,
    appliedRewardDiscount,
    promoDiscount,
    total,
  };
}
