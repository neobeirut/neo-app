export function calculateCartTotals(cartItems) {
  const safeItems = Array.isArray(cartItems) ? cartItems : [];

  console.log("[CART TOTALS] Calculating for", safeItems.length, "items");

  const totalItems = safeItems.reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0,
  );

  const subtotal = safeItems.reduce((sum, item, index) => {
    const rawPrice = parseFloat(item?.price);
    const itemPrice = Number.isFinite(rawPrice) ? rawPrice : 0;

    // Calculate addons price (from product_addons table)
    const addonsPrice =
      item?.addons?.reduce((addonSum, addon) => {
        const rawAddonPrice = parseFloat(addon?.price || 0);
        const addonPrice = Number.isFinite(rawAddonPrice) ? rawAddonPrice : 0;
        const addonQty = Number(addon?.quantity || 1);
        return addonSum + addonPrice * addonQty;
      }, 0) || 0;

    // Calculate customizations price (options + addon-type customizations)
    const customizationsPrice = (
      Array.isArray(item?.customizations) ? item.customizations : []
    ).reduce((cSum, c) => {
      const t = c?.type || c?.customization_type;
      // Only "addon" and "option" types have prices
      const isPriced = t === "addon" || t === "option";
      if (!isPriced) {
        return cSum;
      }
      const raw = parseFloat(c?.price || 0);
      const p = Number.isFinite(raw) ? raw : 0;
      return cSum + p;
    }, 0);

    const qty = Number(item?.quantity || 0);
    const itemTotal = (itemPrice + addonsPrice + customizationsPrice) * qty;

    console.log(`[CART TOTALS] Item ${index}:`, {
      name: item?.name,
      itemPrice,
      addonsPrice,
      customizationsPrice,
      qty,
      itemTotal,
    });

    return sum + itemTotal;
  }, 0);

  console.log("[CART TOTALS] Final:", {
    totalItems,
    subtotal: subtotal.toFixed(2),
  });

  return { totalItems, subtotal };
}
