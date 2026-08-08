import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";

export async function processOrderItems({ request, items, effectiveBranchId }) {
  let subtotalAmount = 0;
  const orderItems = [];
  const inventoryDeductions = [];

  for (const item of items) {
    const productId = item.product_id;
    const qty = Number(item.quantity || 0);

    if (!productId || qty < 1) {
      return {
        ok: false,
        response: corsJson(
          request,
          { error: "Invalid order items" },
          { status: 400 },
        ),
      };
    }

    const [product] = await sql`
      SELECT id, name, price, status, inventory_applies
      FROM products
      WHERE id = ${productId}
    `;

    if (!product) {
      return {
        ok: false,
        response: corsJson(
          request,
          { error: `Product with ID ${productId} not found` },
          { status: 400 },
        ),
      };
    }

    const [pbs] = await sql`
      SELECT id, status, price, quantity_on_hand
      FROM product_branch_status
      WHERE product_id = ${productId} AND branch_id = ${effectiveBranchId}
    `;

    const effectivePriceRaw = pbs?.price ?? product.price;
    const productPrice = Number.parseFloat(effectivePriceRaw);

    if (!Number.isFinite(productPrice)) {
      return {
        ok: false,
        response: corsJson(
          request,
          { error: "Invalid product price" },
          { status: 400 },
        ),
      };
    }

    // Inventory enforcement
    if (product.inventory_applies) {
      if (!pbs) {
        return {
          ok: false,
          response: corsJson(
            request,
            {
              error: "Insufficient stock",
              code: "INSUFFICIENT_STOCK",
              items: [
                {
                  product_id: productId,
                  product_name: product.name,
                  requested: qty,
                  available: 0,
                },
              ],
            },
            { status: 409 },
          ),
        };
      }

      const qoh =
        pbs.quantity_on_hand === null || pbs.quantity_on_hand === undefined
          ? 0
          : Number(pbs.quantity_on_hand);

      if (qty > qoh) {
        return {
          ok: false,
          response: corsJson(
            request,
            {
              error: "Insufficient stock",
              code: "INSUFFICIENT_STOCK",
              items: [
                {
                  product_id: productId,
                  product_name: product.name,
                  requested: qty,
                  available: qoh,
                },
              ],
            },
            { status: 409 },
          ),
        };
      }

      inventoryDeductions.push({ product_id: productId, quantity: qty });
    }

    let itemTotal = productPrice * qty;

    // Calculate customization costs (add-ons add to price)
    let customizationTotal = 0;
    if (item.customizations && item.customizations.length > 0) {
      const addonCustomizationSum = item.customizations
        .filter((c) => c.customization_type === "addon" || c.type === "addon")
        .reduce((sum, c) => sum + Number.parseFloat(c.price || 0), 0);

      customizationTotal = addonCustomizationSum * qty;
    }

    // Calculate addon costs (existing addon system)
    let addonTotal = 0;
    if (item.selected_addons && item.selected_addons.length > 0) {
      const addons = await sql`
        SELECT price FROM product_addons
        WHERE id = ANY(${item.selected_addons}) AND product_id = ${productId}
      `;
      const addonsSum = addons.reduce(
        (sum, addon) => sum + Number.parseFloat(addon.price || 0),
        0,
      );
      addonTotal = addonsSum * qty;
    }

    itemTotal += addonTotal + customizationTotal;
    subtotalAmount += itemTotal;

    const normalizedComment =
      item.comment === null || item.comment === undefined
        ? null
        : String(item.comment).trim() || null;

    const normalizedCustomizations = Array.isArray(item.customizations)
      ? item.customizations.map((c) => {
          const customizationType =
            c?.customization_type || c?.type || c?.customizationType || null;

          return {
            ...c,
            customization_type: customizationType,
          };
        })
      : [];

    orderItems.push({
      product_id: productId,
      quantity: qty,
      unit_price: productPrice,
      total_price: itemTotal,
      selected_addons: item.selected_addons || [],
      customizations: normalizedCustomizations,
      comment: normalizedComment,
    });
  }

  return { ok: true, subtotalAmount, orderItems, inventoryDeductions };
}
