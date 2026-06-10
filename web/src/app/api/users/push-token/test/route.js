import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

function getHeaderUserId(request) {
  const raw =
    request.headers.get("x-auth-user-id") ||
    request.headers.get("X-Auth-User-Id") ||
    request.headers.get("X-AUTH-USER-ID");

  if (!raw) return null;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

async function getUserPushTokens(userId) {
  // legacy field
  const [user] = await sql`
    SELECT id, push_token
    FROM auth_users
    WHERE id = ${Number(userId)} AND is_active = true
    LIMIT 1
  `;

  if (!user?.id) {
    return { tokens: [], legacy: null };
  }

  const rows = await sql(
    "SELECT token FROM user_push_tokens WHERE user_id = $1 ORDER BY updated_at DESC",
    [Number(userId)],
  ).catch(() => []);

  const fromTable = (rows || [])
    .map((r) => (r?.token ? String(r.token) : ""))
    .filter(Boolean);

  const all = [...fromTable];
  const legacy = user?.push_token ? String(user.push_token) : null;
  if (legacy && !all.includes(legacy)) {
    all.push(legacy);
  }

  return { tokens: Array.from(new Set(all)), legacy };
}

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
  };

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

  return {
    httpOk: response.ok,
    httpStatus: response.status,
    ok: response.ok && expoStatus !== "error",
    expo: expoData,
    ticketId,
  };
}

async function getExpoReceipts(ticketIds) {
  const ids = (ticketIds || []).filter(Boolean).map((x) => String(x));
  if (ids.length === 0) {
    return { ok: true, receipts: {} };
  }

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

    return {
      ok: response.ok,
      httpStatus: response.status,
      receipts,
    };
  } catch (e) {
    console.error("[push-test] receipt lookup failed", e);
    return { ok: false, httpStatus: null, receipts: {} };
  }
}

export async function POST(request) {
  try {
    // Check if this is an admin request
    const adminUser = await getAdminWithRolesFromRequest(request);

    let targetUserId;

    if (adminUser) {
      // Admin request - get userId from body
      const body = await request.json().catch(() => ({}));
      targetUserId = body?.userId ? parseInt(body.userId, 10) : null;

      if (!targetUserId) {
        return Response.json(
          { error: "userId is required for admin requests" },
          { status: 400 },
        );
      }
    } else {
      // Regular user request - get from headers
      targetUserId = getHeaderUserId(request);

      if (!targetUserId) {
        return Response.json(
          {
            error:
              "Authentication required (missing X-Auth-User-Id). Call this endpoint from the mobile app so headers are attached.",
          },
          { status: 401 },
        );
      }
    }

    const { tokens } = await getUserPushTokens(targetUserId);

    if (tokens.length === 0) {
      return Response.json(
        { error: "No push tokens saved for this user", user_id: targetUserId },
        { status: 400 },
      );
    }

    const body = adminUser
      ? await request.json().catch(() => ({}))
      : await request.json().catch(() => ({}));
    const title = body?.title ? String(body.title) : "Test notification";
    const msg = body?.body ? String(body.body) : "If you see this, push works.";

    const results = [];
    const ticketIds = [];

    for (const token of tokens) {
      const r = await sendPushNotification(token, title, msg, {
        kind: "test",
        ts: Date.now(),
      });
      if (r.ticketId) {
        ticketIds.push(r.ticketId);
      }
      results.push({ token: token.slice(0, 14) + "…", ...r });
    }

    // IMPORTANT: Expo may accept tickets and then fail delivery later.
    // Wait briefly, then query receipts so we can surface real errors like InvalidCredentials.
    await new Promise((r) => setTimeout(r, 1200));

    const receiptResult = await getExpoReceipts(ticketIds);

    const resultsWithReceipts = results.map((r) => {
      const receipt = r.ticketId
        ? receiptResult?.receipts?.[r.ticketId] || null
        : null;
      const receiptOk = receipt ? receipt.status !== "error" : null;
      const effectiveOk = receiptOk === null ? r.ok : r.ok && receiptOk;

      return {
        ...r,
        ok: effectiveOk,
        receipt,
      };
    });

    return Response.json({
      success: true,
      user_id: targetUserId,
      sentCount: tokens.length,
      tokens: tokens.length,
      results: resultsWithReceipts,
      receiptsLookup: {
        ok: receiptResult?.ok ?? false,
        httpStatus: receiptResult?.httpStatus ?? null,
      },
    });
  } catch (e) {
    console.error("[push-test] error", e);
    return Response.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
