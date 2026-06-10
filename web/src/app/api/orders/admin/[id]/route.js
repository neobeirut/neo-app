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

// Helper: load all known push tokens for a user (new table), falling back to legacy auth_users.push_token
async function getUserPushTokens(userId, legacyToken) {
  if (!userId) {
    return [];
  }

  try {
    const [tbl] = await sql`
      SELECT to_regclass('public.user_push_tokens') as name
    `;

    const hasTable = !!tbl?.name;
    if (!hasTable) {
      return legacyToken ? [String(legacyToken)] : [];
    }

    const rows = await sql(
      "SELECT token FROM user_push_tokens WHERE user_id = $1 ORDER BY updated_at DESC",
      [Number(userId)],
    );

    const tokens = rows
      .map((r) => (r?.token ? String(r.token) : ""))
      .filter(Boolean);

    // Backward-compat: include legacy token if present and not already listed
    if (legacyToken) {
      const legacy = String(legacyToken);
      if (!tokens.includes(legacy)) {
        tokens.push(legacy);
      }
    }

    // Dedupe
    return Array.from(new Set(tokens));
  } catch (e) {
    console.error("[push] Failed to load user_push_tokens; falling back", e);
    return legacyToken ? [String(legacyToken)] : [];
  }
}

async function pruneInvalidPushToken(userId, token) {
  try {
    const [tbl] = await sql`
      SELECT to_regclass('public.user_push_tokens') as name
    `;
    const hasTable = !!tbl?.name;

    if (hasTable) {
      await sql(
        "DELETE FROM user_push_tokens WHERE user_id = $1 AND token = $2",
        [Number(userId), String(token)],
      );
    }

    // If legacy field matches, clear it.
    await sql`
      UPDATE auth_users
      SET push_token = NULL
      WHERE id = ${Number(userId)} AND push_token = ${String(token)}
    `;
  } catch (e) {
    console.error("[push] Failed to prune invalid token", e);
  }
}

// Helper function to send push notification
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const parsed = await response.json().catch(() => null);

    // Note: Expo can return HTTP 200 with per-message errors.
    const expoData = parsed?.data || null;
    const expoStatus = expoData?.status || null;
    const ticketId = expoData?.id ? String(expoData.id) : null;

    if (!response.ok || expoStatus === "error") {
      console.error("[push] Expo push error", {
        httpStatus: response.status,
        httpOk: response.ok,
        expo: expoData,
      });

      return {
        ok: false,
        httpStatus: response.status,
        expo: expoData,
        ticketId,
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      expo: expoData,
      ticketId,
    };
  } catch (error) {
    console.error("[push] Error sending push notification:", error);
    return { ok: false, httpStatus: null, expo: null, ticketId: null };
  }
}

async function getExpoReceipts(ticketIds) {
  const ids = (ticketIds || []).filter(Boolean).map((x) => String(x));
  if (ids.length === 0) return { ok: true, receipts: {}, httpStatus: null };

  try {
    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      },
    );

    const parsed = await response.json().catch(() => null);
    const receipts =
      parsed?.data && typeof parsed.data === "object" ? parsed.data : {};

    return { ok: response.ok, httpStatus: response.status, receipts };
  } catch (e) {
    console.error("[push] receipt lookup failed", e);
    return { ok: false, httpStatus: null, receipts: {} };
  }
}

// Get status display text
function getStatusMessage(status) {
  const statusMessages = {
    pending: "Your order has been received",
    accepted: "Your order has been accepted",
    preparing: "Your order is being prepared",
    ready: "Your order is ready for pickup",
    out_for_delivery: "Your order is out for delivery",
    completed: "Your order has been completed",
    cancelled: "Your order has been cancelled",
  };
  return statusMessages[status] || "Your order status has been updated";
}

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
      SELECT status FROM orders WHERE id = ${id}
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
      WHERE id = ${id}
    `;

    // Award loyalty points ONLY when the order becomes completed
    let loyaltyResult = { awarded: false, points: 0 };
    if (status === "completed") {
      loyaltyResult = await awardLoyaltyIfNeededForCompletedOrder(id);
    }

    // Redeem/release tier/perk rewards based on order status
    if (status === "completed" || status === "cancelled") {
      await redeemOrReleaseUserRewardForOrder({ orderId: id, status });
    }

    // ========== Send WhatsApp notification automatically (direct call, no HTTP) ==========
    let whatsappResult = { attempted: false, sent: false, error: null };
    try {
      console.log(`[admin-order-update] Sending WhatsApp for order ${id}...`);

      const whatsappData = await sendWhatsAppNotification(id, status);

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

    // Get order details and user push token
    const orderDetails = await sql`
      SELECT o.user_id, u.push_token, u.name
      FROM orders o
      JOIN auth_users u ON o.user_id = u.id
      WHERE o.id = ${id}
    `;

    let pushDebug = {
      attempted: false,
      tokens: 0,
      results: [],
      receipts: null,
    };

    // Send push notification if user has a push token
    if (orderDetails.length > 0 && orderDetails[0].user_id) {
      const userId = Number(orderDetails[0].user_id);
      const legacyToken = orderDetails[0].push_token;
      const tokens = await getUserPushTokens(userId, legacyToken);

      if (tokens.length > 0) {
        const title = "Order Update";
        const body = getStatusMessage(status);

        pushDebug.attempted = true;
        pushDebug.tokens = tokens.length;

        const ticketIds = [];

        for (const token of tokens) {
          const result = await sendPushNotification(token, title, body, {
            orderId: id,
            status,
          });

          if (result.ticketId) {
            ticketIds.push(result.ticketId);
          }

          pushDebug.results.push({
            token: token.slice(0, 14) + "…",
            ...result,
          });

          // If Expo says the device/token is not registered, clean it up.
          const expoErr = result?.expo?.details?.error;
          if (expoErr === "DeviceNotRegistered") {
            await pruneInvalidPushToken(userId, token);
          }
        }

        // Best-effort: check receipts to catch late failures (InvalidCredentials, etc.)
        await new Promise((r) => setTimeout(r, 1200));
        const receiptResult = await getExpoReceipts(ticketIds);
        pushDebug.receipts = {
          ok: receiptResult?.ok ?? false,
          httpStatus: receiptResult?.httpStatus ?? null,
          data: receiptResult?.receipts || {},
        };

        // Merge receipt errors into per-token ok flags (debug only)
        pushDebug.results = pushDebug.results.map((r) => {
          const receipt = r.ticketId
            ? receiptResult?.receipts?.[r.ticketId] || null
            : null;
          const receiptOk = receipt ? receipt.status !== "error" : null;
          const effectiveOk = receiptOk === null ? r.ok : r.ok && receiptOk;
          return { ...r, ok: effectiveOk, receipt };
        });
      }
    }

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

    await sql`
      DELETE FROM orders WHERE id = ${id}
    `;

    return Response.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    return Response.json(
      { error: "Failed to delete order", details: error.message },
      { status: 500 },
    );
  }
}
