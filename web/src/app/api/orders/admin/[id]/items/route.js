import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { resolveOrderId } from "../../../utils/orderIdResolver";

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

function hasOrdersAccess(admin) {
  if (!admin) return false;
  if (!admin.roles || admin.roles.length === 0) return true;
  return admin.roles.some((r) =>
    ["admin", "owner", "orders", "backend", "superadmin"].includes(r),
  );
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

    if (!hasOrdersAccess(admin)) {
      return Response.json(
        { error: "Unauthorized - orders permission required" },
        { status: 403 },
      );
    }

    const { id } = params;

    const resolvedId = await resolveOrderId(id);
    if (!resolvedId) {
      return Response.json({ error: "Order not found" }, { status: 404 });
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

    // ── Pre-fetch all referenced products and product addons in bulk for performance ──
    const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
    const products = productIds.length > 0
      ? await sql`SELECT id, price FROM products WHERE id = ANY(${productIds})`
      : [];
    const productMap = new Map(products.map((p) => [p.id, parseFloat(p.price || 0)]));

    for (const item of items) {
      if (!productMap.has(item.product_id)) {
        return Response.json(
          { error: `Product with ID ${item.product_id} not found` },
          { status: 400 },
        );
      }
    }

    const allAddonIds = Array.from(
      new Set(items.flatMap((i) => (Array.isArray(i.selected_addons) ? i.selected_addons : []))),
    );
    const allAddons = allAddonIds.length > 0
      ? await sql`SELECT id, price FROM product_addons WHERE id = ANY(${allAddonIds})`
      : [];
    const addonMap = new Map(allAddons.map((a) => [a.id, parseFloat(a.price || 0)]));

    // ── Helper to clean and sanitize customizations so no double-escaped strings are saved ──
    const sanitizeCustomizations = (raw) => {
      if (!raw) return [];
      let parsed = raw;
      while (typeof parsed === "string") {
        const trimmed = parsed.trim();
        if (
          (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith('"') && trimmed.endsWith('"'))
        ) {
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            break;
          }
        } else {
          break;
        }
      }

      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === "string") {
            if (item.trim().startsWith("{") && item.trim().endsWith("}")) {
              try {
                return JSON.parse(item);
              } catch {
                return { ingredient: item.trim() };
              }
            }
            return { ingredient: item.trim() };
          }
          return item;
        });
      }

      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.split(",").map((s) => ({ ingredient: s.trim() })).filter((x) => x.ingredient);
      }

      if (typeof parsed === "object" && parsed !== null) {
        return [parsed];
      }

      return [];
    };

    // ── Execute all DB modifications inside a single fast atomic transaction ──
    await sql.transaction(async (txn) => {
      // ── Step 1: Delete removed order_items rows ──
      const submittedItemIds = items
        .map((i) => i.id)
        .filter((id) => typeof id === "number");

      if (submittedItemIds.length > 0) {
        await txn(
          `DELETE FROM order_items WHERE order_id = $1 AND id NOT IN (${submittedItemIds.map((_, i) => `$${i + 2}`).join(",")})`,
          [resolvedId, ...submittedItemIds],
        );
      } else {
        await txn`DELETE FROM order_items WHERE order_id = ${resolvedId}`;
      }

      // ── Step 2: Upsert each submitted item ──
      for (const item of items) {
        const basePrice = productMap.get(item.product_id) || 0;
        const itemAddonPrices = (item.selected_addons || [])
          .map((id) => ({ price: addonMap.get(id) || 0 }))
          .filter((a) => a.price !== undefined);

        const cleanCustomizations = sanitizeCustomizations(item.customizations);
        const unitPrice = calcUnitPrice(
          basePrice,
          cleanCustomizations,
          itemAddonPrices,
        );
        const quantity = parseInt(item.quantity, 10) || 1;
        const itemTotal = unitPrice * quantity;
        const customizationsJson = JSON.stringify(cleanCustomizations);
        const comment = item.comment || null;

        let orderItemId;

        if (item.id) {
          await txn`
            UPDATE order_items
            SET
              quantity = ${quantity},
              unit_price = ${unitPrice},
              total_price = ${itemTotal},
              customizations = ${customizationsJson}::jsonb,
              comment = ${comment}
            WHERE id = ${item.id} AND order_id = ${resolvedId}
          `;
          orderItemId = item.id;
        } else {
          const [newRow] = await txn`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, customizations, comment)
            VALUES (
              ${resolvedId},
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

        // Sync product addons (order_item_addons table)
        await txn`DELETE FROM order_item_addons WHERE order_item_id = ${orderItemId}`;

        if (item.selected_addons && item.selected_addons.length > 0) {
          for (const addonId of item.selected_addons) {
            const price = addonMap.get(addonId);
            if (price !== undefined) {
              await txn`
                INSERT INTO order_item_addons (order_item_id, product_addon_id, quantity, price)
                VALUES (${orderItemId}, ${addonId}, 1, ${price})
              `;
            }
          }
        }
      }

      // ── Step 3: Recalculate order totals ──
      const [sumRow] = await txn`
        SELECT COALESCE(SUM(total_price), 0) as items_total FROM order_items WHERE order_id = ${resolvedId}
      `;
      const itemsTotal = parseFloat(sumRow.items_total);

      const [currentOrder] = await txn`
        SELECT delivery_fee, discount_amount, promo_discount FROM orders WHERE id = ${resolvedId}
      `;

      const deliveryFee = parseFloat(currentOrder?.delivery_fee || 0);
      const rewardDiscount = parseFloat(currentOrder?.discount_amount || 0);
      const promoDiscount = parseFloat(currentOrder?.promo_discount || 0);

      const subtotal = itemsTotal;
      const totalBeforeDiscount = subtotal + deliveryFee;
      const totalAfterDiscount =
        totalBeforeDiscount - rewardDiscount - promoDiscount;

      await txn`
        UPDATE orders
        SET
          subtotal_amount = ${subtotal},
          total_before_discount = ${totalBeforeDiscount},
          total_after_discount = ${totalAfterDiscount},
          total_amount = ${totalAfterDiscount}
        WHERE id = ${resolvedId}
      `;
    });

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

    const resolvedId = await resolveOrderId(id);
    if (!resolvedId) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const guard = await assertOrderItemEditsAllowed(resolvedId);
    if (!guard.ok) {
      return guard.response;
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");

    if (!itemId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    await sql`
      DELETE FROM order_items WHERE id = ${itemId} AND order_id = ${resolvedId}
    `;

    const [sumRow] = await sql`
      SELECT COALESCE(SUM(total_price), 0) as items_total FROM order_items WHERE order_id = ${resolvedId}
    `;
    const newTotal = parseFloat(sumRow.items_total);

    await sql`
      UPDATE orders SET total_amount = ${newTotal} WHERE id = ${resolvedId}
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
