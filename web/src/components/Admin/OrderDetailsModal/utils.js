export const formatMoney = (value) => {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) {
    return "$0.00";
  }
  return `$${num.toFixed(2)}`;
};

export const calculateItemsTotal = (items) => {
  return items.reduce((sum, item) => {
    const itemTotal = item.quantity * parseFloat(item.unit_price);
    const addonsTotal = item.addons
      ? item.addons.reduce(
          (addonSum, addon) =>
            addonSum + parseFloat(addon.price) * addon.quantity,
          0,
        ) * item.quantity
      : 0;
    return sum + itemTotal + addonsTotal;
  }, 0);
};

export const calculateOrderTotals = (order, itemsTotal) => {
  const subtotalAmount =
    order.subtotal_amount != null
      ? Number.parseFloat(order.subtotal_amount)
      : itemsTotal;

  const deliveryFee =
    order.delivery_fee != null ? Number.parseFloat(order.delivery_fee) : 0;

  const rewardDiscount =
    order.discount_amount != null
      ? Number.parseFloat(order.discount_amount)
      : 0;

  const promoDiscount =
    order.promo_discount != null ? Number.parseFloat(order.promo_discount) : 0;

  const totalBeforeDiscount =
    order.total_before_discount != null
      ? Number.parseFloat(order.total_before_discount)
      : subtotalAmount + deliveryFee;

  const totalCharged =
    order.total_after_discount != null
      ? Number.parseFloat(order.total_after_discount)
      : order.total_amount != null
        ? Number.parseFloat(order.total_amount)
        : totalBeforeDiscount - rewardDiscount - promoDiscount;

  return {
    subtotalAmount,
    deliveryFee,
    rewardDiscount,
    promoDiscount,
    totalBeforeDiscount,
    totalCharged,
  };
};

export const getAdminHeaders = () => {
  const adminToken =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const adminId =
    typeof window !== "undefined" ? localStorage.getItem("admin_id") : null;

  return {
    "Content-Type": "application/json",
    ...(adminToken ? { "x-admin-token": adminToken } : {}),
    ...(adminId ? { "x-admin-id": adminId } : {}),
  };
};
