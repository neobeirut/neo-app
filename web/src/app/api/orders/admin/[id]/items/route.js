import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

const LOCKED_FOR_ITEM_EDITS = [
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];

async function assertOrderItemEditsAllowed(orderId) {
  const [order] = await sql`
    SELECT status FROM orders WHERE id = ${orderId}
  `;

  if (!order) {
    return {
      ok: false,
      response: Response.json({ error: "Order not found" }, { status: 404 }),
    };
  }

  if (LOCKED_FOR_ITEM_EDITS.includes(order.status)) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "Cannot modify locked order items (ready, out for delivery, completed, or cancelled)",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, response: null };
}

/**
 * Calculate unit price from base product price + customization prices + product addon prices.
 * customizations: array of { customization_type, price } from the JSON payload
 * productAddonPrices: array of { price } fetched from DB for selected_addons
 */
function calcUnitPrice(basePrice, customizations, productAddonPrices) {
  let total = parseFloat(basePrice || 0);

  for (const c of customizations || []) {
    const cType = c.customization_type || c.type;
    if (cType === "option" || cType === "addon") {
      total += parseFloat(c.price || 0);
    }
  }

  for (const a of productAddonPrices || []) {
    total += parseFloat(a.price || 0);
  }

  return total;
}

// Update order items (for admin)
export async function PUT(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    if (!admin.roles || !admin.roles.includes("orders")) {
      return Response.json(
        { error: "Unauthorized - orders permission required" },
        { status: 403 },
      );
    }

    const { id } = params;

    const guard = await assertOrderItemEditsAllowed(id);
    if (!guard.ok) {
      return guard.response;
    }

    const body = await request.json();
    // items: Array of {
    //   id?,            existing DB row id (undefined = new item)
    //   product_id,
    //   quantity,
    //   customizations?, // array of { id, ingredient, customization_type, price, option_group_name }
    //   selected_addons?, // array of product_addon IDs
    //   comment?
    // }
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "Items array is required" },
        { status: 400 },
      );
    }

    // ── Step 1: Delete order_items rows NOT in the submitted list ──────────
    // This handles the "remove item" flow where the UI just filters the array.
    const submittedItemIds = items
      .map((i) => i.id)
      .filter((id) => typeof id === "number");

    if (submittedItemIds.length > 0) {
      // Delete items that exist in DB but aren't in the submitted list
      await sql(
        `DELETE FROM order_items WHERE order_id = $1 AND id NOT IN (${submittedItemIds.map((_, i) => `$${i + 2}`).join(",")})`,
        [id, ...submittedItemIds],
      );
    } else {
      // All items are new — delete everything first (shouldn't normally happen)
      await sql`DELETE FROM order_items WHERE order_id = ${id}`;
    }

    // ── Step 2: Upsert each submitted item ──────────────────────────────────
    let totalAmount = 0;

    for (const item of items) {
      // Fetch product to validate + get base price
      const [product] = await sql`
        SELECT id, price FROM products WHERE id = ${item.product_id}
      `;

      if (!product) {
        return Response.json(
          { error: `Product with ID ${item.product_id} not found` },
          { status: 400 },
        );
      }

      const basePrice = parseFloat(product.price);

      // Fetch product addon prices for selected_addons
      let addonPrices = [];
      if (item.selected_addons && item.selected_addons.length > 0) {
        addonPrices = await sql`
          SELECT id, price FROM product_addons
          WHERE id = ANY(${item.selected_addons})
        `;
      }

      const unitPrice = calcUnitPrice(
        basePrice,
        item.customizations || [],
        addonPrices,
      );
      const itemTotal = unitPrice * (item.quantity || 1);
      totalAmount += itemTotal;

      const customizationsJson = JSON.stringify(item.customizations || []);
      const comment = item.comment || null;
      const quantity = item.quantity || 1;

      let orderItemId;

      if (item.id) {
        // ── Update existing item ──
        await sql`
          UPDATE order_items
          SET
            quantity = ${quantity},
            unit_price = ${unitPrice},
            total_price = ${itemTotal},
            customizations = ${customizationsJson}::jsonb,
            comment = ${comment}
          WHERE id = ${item.id} AND order_id = ${id}
        `;
        orderItemId = item.id;
      } else {
        // ── Insert new item ──
        const [newRow] = await sql`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, customizations, comment)
          VALUES (
            ${id},
            ${item.product_id},
            ${quantity},
            ${unitPrice},
            ${itemTotal},
            ${customizationsJson}::jsonb,
            ${comment}
          )
          RETURNING id
        `;
        orderItemId = newRow.id;
      }

      // ── Sync product addons (order_item_addons table) ──
      await sql`DELETE FROM order_item_addons WHERE order_item_id = ${orderItemId}`;

      if (item.selected_addons && item.selected_addons.length > 0) {
        for (const addonId of item.selected_addons) {
          const addonRow = addonPrices.find((a) => a.id === addonId);
          if (addonRow) {
            await sql`
              INSERT INTO order_item_addons (order_item_id, product_addon_id, quantity, price)
              VALUES (${orderItemId}, ${addonId}, 1, ${addonRow.price})
            `;
          }
        }
      }
    }

    // ── Step 3: Recalculate order totals ─────────────────────────────────────
    // Re-sum from DB to be accurate (handles any rounding)
    const [sumRow] = await sql`
      SELECT COALESCE(SUM(total_price), 0) as items_total FROM order_items WHERE order_id = ${id}
    `;
    const itemsTotal = parseFloat(sumRow.items_total);

    // Fetch current order for delivery fee / promo info
    const [currentOrder] = await sql`
      SELECT delivery_fee, discount_amount, promo_discount FROM orders WHERE id = ${id}
    `;

    const deliveryFee = parseFloat(currentOrder?.delivery_fee || 0);
    const rewardDiscount = parseFloat(currentOrder?.discount_amount || 0);
    const promoDiscount = parseFloat(currentOrder?.promo_discount || 0);

    const subtotal = itemsTotal;
    const totalBeforeDiscount = subtotal + deliveryFee;
    const totalAfterDiscount =
      totalBeforeDiscount - rewardDiscount - promoDiscount;

    await sql`
      UPDATE orders
      SET
        subtotal_amount = ${subtotal},
        total_before_discount = ${totalBeforeDiscount},
        total_after_discount = ${totalAfterDiscount},
        total_amount = ${totalAfterDiscount}
      WHERE id = ${id}
    `;

    return Response.json({
      message: "Order items updated successfully",
      total_amount: totalAfterDiscount,
      subtotal: subtotal,
    });
  } catch (error) {
    console.error("Error updating order items:", error);
    return Response.json(
      { error: "Failed to update order items", details: error.message },
      { status: 500 },
    );
  }
}

// Delete a single order item (for admin)
export async function DELETE(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    if (!admin.roles || !admin.roles.includes("orders")) {
      return Response.json(
        { error: "Unauthorized - orders permission required" },
        { status: 403 },
      );
    }

    const { id } = params;

    const guard = await assertOrderItemEditsAllowed(id);
    if (!guard.ok) {
      return guard.response;
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");

    if (!itemId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    await sql`
      DELETE FROM order_items WHERE id = ${itemId} AND order_id = ${id}
    `;

    const [sumRow] = await sql`
      SELECT COALESCE(SUM(total_price), 0) as items_total FROM order_items WHERE order_id = ${id}
    `;
    const newTotal = parseFloat(sumRow.items_total);

    await sql`
      UPDATE orders SET total_amount = ${newTotal} WHERE id = ${id}
    `;

    return Response.json({
      message: "Order item deleted successfully",
      total_amount: newTotal,
    });
  } catch (error) {
    console.error("Error deleting order item:", error);
    return Response.json(
      { error: "Failed to delete order item", details: error.message },
      { status: 500 },
    );
  }
}
