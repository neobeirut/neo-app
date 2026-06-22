import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import {
  applyTierLock,
  computeTierFromTotalSpent,
  getTierThresholds,
  redeemOrReleaseUserRewardForOrder,
  lockUntilMonthsFromNowDate,
} from "@/app/api/utils/loyalty";
import { sendWhatsAppNotification } from "@/app/api/utils/whatsappNotification";
import { resolveOrderId } from "../../utils/orderIdResolver";

// Push notification helpers removed. Managed centrally via whatsappNotification.js

async function awardLoyaltyIfNeededForCompletedOrder(orderId) {
  // Idempotency: only award once per order
  const [existing] = await sql`
    SELECT id
    FROM loyalty_transactions
    WHERE related_order_id = ${orderId} AND transaction_type = 'earned'
    LIMIT 1
  `;

  if (existing) {
    return { awarded: false, points: 0 };
  }

  const [order] = await sql`
    SELECT
      o.user_id,
      o.total_amount,
      o.delivery_fee,
      o.loyalty_base_amount
    FROM orders o
    WHERE o.id = ${orderId}
    LIMIT 1
  `;

  if (!order?.user_id) {
    return { awarded: false, points: 0 };
  }

  const deliveryFee = Number.parseFloat(order.delivery_fee ?? 0) || 0;

  // For older orders that were created before loyalty_base_amount existed,
  // approximate base as total - delivery fee.
  const baseRaw =
    order.loyalty_base_amount === null ||
    order.loyalty_base_amount === undefined
      ? Number.parseFloat(order.total_amount ?? 0) - deliveryFee
      : Number.parseFloat(order.loyalty_base_amount);

  const loyaltyBase = Number.isFinite(baseRaw) ? Math.max(baseRaw, 0) : 0;

  const pointsEarned = Math.floor(loyaltyBase); // 1 point per $1

  if (pointsEarned <= 0) {
    await sql`
      UPDATE orders
      SET points_awarded = 0
      WHERE id = ${orderId}
    `;
    return { awarded: false, points: 0 };
  }

  await sql.transaction([
    sql`
      INSERT INTO loyalty_transactions (
        user_id,
        transaction_type,
        points,
        description,
        related_order_id
      ) VALUES (
        ${order.user_id},
        'earned',
        ${pointsEarned},
        ${`Earned from order #${orderId}`},
        ${orderId}
      )
    `,
    sql`
      UPDATE auth_users
      SET
        points = COALESCE(points, 0) + ${pointsEarned},
        total_spent = COALESCE(total_spent, 0) + ${loyaltyBase}
      WHERE id = ${order.user_id}
    `,
    sql`
      UPDATE orders
      SET points_awarded = ${pointsEarned}
      WHERE id = ${orderId}
    `,
  ]);

  // Update membership tier based on POINTS (not total spent) + tier lock (no downgrades for 12 months after upgrade)
  const thresholds = await getTierThresholds();

  const [user] = await sql`
    SELECT membership_tier, tier_locked_until, points
    FROM auth_users
    WHERE id = ${order.user_id}
  `;

  const computedTier = computeTierFromTotalSpent(
    Number.parseInt(user?.points ?? 0, 10) || 0,
    thresholds,
  );

  const lockResult = applyTierLock({
    currentTier: user?.membership_tier || "Bronze",
    currentTierLockedUntil: user?.tier_locked_until || null,
    computedTier,
  });

  const finalTier = lockResult.finalTier;

  // If upgraded, lock tier for 12 months from the upgrade date
  let nextLockedUntil = user?.tier_locked_until || null;
  if (lockResult.upgraded) {
    nextLockedUntil = lockUntilMonthsFromNowDate(new Date(), 12)
      .toISOString()
      .slice(0, 10);
  }

  await sql`
    UPDATE auth_users
    SET membership_tier = ${finalTier}, tier_locked_until = ${nextLockedUntil}
    WHERE id = ${order.user_id}
  `;

  return { awarded: true, points: pointsEarned };
}

// Update order status (for admin)
export async function PATCH(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    // Check if admin has orders role
    if (!admin.roles || !admin.roles.includes("orders")) {
      return Response.json(
        { error: "Unauthorized - orders permission required" },
        { status: 403 },
      );
    }

    const { id } = params;
    const { status } = await request.json();

    const resolvedId = await resolveOrderId(id);
    if (!resolvedId) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "out_for_delivery",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    // Status updates are allowed even when order content is locked.
    // Only final states are locked from further status changes.
    const [currentOrder] = await sql`
      SELECT status FROM orders WHERE id = ${resolvedId}
    `;

    if (!currentOrder) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (["completed", "cancelled"].includes(currentOrder.status)) {
      return Response.json(
        {
          error: "Cannot modify final orders (completed or cancelled)",
        },
        { status: 403 },
      );
    }

    await sql`
      UPDATE orders
      SET status = ${status}
      WHERE id = ${resolvedId}
    `;

    // Award loyalty points ONLY when the order becomes completed
    let loyaltyResult = { awarded: false, points: 0 };
    if (status === "completed") {
      loyaltyResult = await awardLoyaltyIfNeededForCompletedOrder(resolvedId);
    }

    // Redeem/release tier/perk rewards based on order status
    if (status === "completed" || status === "cancelled") {
      await redeemOrReleaseUserRewardForOrder({ orderId: resolvedId, status });
    }

    // ========== Send WhatsApp notification automatically (direct call, no HTTP) ==========
    let whatsappResult = { attempted: false, sent: false, error: null };
    try {
      console.log(`[admin-order-update] Sending WhatsApp for order ${resolvedId}...`);

      const whatsappData = await sendWhatsAppNotification(resolvedId, status);

      whatsappResult.attempted = true;
      whatsappResult.sent = whatsappData?.ok && whatsappData?.sent;
      whatsappResult.error = whatsappData?.error || null;
      whatsappResult.method = whatsappData?.method || null;
      whatsappResult.templateName = whatsappData?.templateName || null;
      whatsappResult.messageId = whatsappData?.messageId || null;

      if (!whatsappData?.ok) {
        console.log(
          `[admin-order-update] WhatsApp notification failed for order ${id}:`,
          whatsappData?.error || "Unknown error",
        );
      } else {
        console.log(
          `[admin-order-update] WhatsApp notification sent for order ${id} via ${whatsappData?.method}`,
        );
      }
    } catch (whatsappError) {
      console.error(
        `[admin-order-update] WhatsApp notification error for order ${id}:`,
        whatsappError,
      );

      const errorMsg = String(whatsappError?.message || whatsappError);
      whatsappResult.attempted = true;
      whatsappResult.error = errorMsg;

      // Extract RAW_RESPONSE if present (contains Infobip's full error response)
      const rawResponseMatch = errorMsg.match(/RAW_RESPONSE=(.+)$/);
      if (rawResponseMatch) {
        try {
          whatsappResult.infobipRawResponse = JSON.parse(rawResponseMatch[1]);
        } catch {
          whatsappResult.infobipRawResponse = rawResponseMatch[1];
        }
      }
    }

    let pushDebug = {
      attempted: false,
      skipped: true,
      reason: "Handled by customer notification service"
    };

    return Response.json({
      message: "Order status updated successfully",
      status,
      loyalty: loyaltyResult,
      whatsapp: whatsappResult,
      push: pushDebug,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return Response.json(
      { error: "Failed to update order status", details: error.message },
      { status: 500 },
    );
  }
}

// Delete order (for admin)
export async function DELETE(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    // Check if admin has orders role
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

    // Start transaction (Neon allows multiple statements in a single template string, but doing them sequentially is safe)
    await sql`DELETE FROM order_item_customizations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ${resolvedId})`;
    await sql`DELETE FROM order_items WHERE order_id = ${resolvedId}`;
    await sql`DELETE FROM orders WHERE id = ${resolvedId}`;

    return Response.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    return Response.json(
      { error: "Failed to delete order", details: error.message },
      { status: 500 },
    );
  }
}
