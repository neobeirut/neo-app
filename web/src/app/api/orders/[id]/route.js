import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

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

    if (legacyToken) {
      const legacy = String(legacyToken);
      if (!tokens.includes(legacy)) {
        tokens.push(legacy);
      }
    }

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

    return { ok: true, httpStatus: response.status, expo: expoData, ticketId };
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

// Update order status
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
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

    await sql`
      UPDATE orders 
      SET status = ${status}
      WHERE id = ${id}
    `;

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

          const expoErr = result?.expo?.details?.error;
          if (expoErr === "DeviceNotRegistered") {
            await pruneInvalidPushToken(userId, token);
          }
        }

        await new Promise((r) => setTimeout(r, 1200));
        const receiptResult = await getExpoReceipts(ticketIds);
        pushDebug.receipts = {
          ok: receiptResult?.ok ?? false,
          httpStatus: receiptResult?.httpStatus ?? null,
          data: receiptResult?.receipts || {},
        };

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

// Delete order
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
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
