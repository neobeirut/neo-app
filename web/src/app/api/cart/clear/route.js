import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function normalizePhone(phone) {
  if (!phone) return null;
  // Normalize to digits only so different formats still match (e.g. +961..., 961..., spaces).
  const cleaned = String(phone)
    .trim()
    .replace(/[^0-9]/g, "");
  return cleaned || null;
}

function phonesMatch(phoneA, phoneB) {
  if (!phoneA || !phoneB) return false;
  const a = String(phoneA).replace(/[^0-9]/g, "");
  const b = String(phoneB).replace(/[^0-9]/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  const cleanA = a.startsWith("961") ? a.slice(3) : a.replace(/^0+/, "");
  const cleanB = b.startsWith("961") ? b.slice(3) : b.replace(/^0+/, "");
  if (cleanA && cleanB && cleanA === cleanB) return true;
  if (cleanA.length >= 7 && cleanB.length >= 7) {
    return cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA);
  }
  return false;
}

async function findUserByPhone(phone) {
  if (!phone) return null;
  const clean = phone.startsWith("961") ? phone.slice(3) : phone.replace(/^0+/, "");
  const rows = await sql(
    `SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm 
     FROM auth_users 
     WHERE (regexp_replace(phone, '[^0-9]', '', 'g') = $1 
        OR regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || $2)
       AND is_active = true 
     ORDER BY id DESC LIMIT 5`,
    [phone, clean],
  );

  for (const row of rows) {
    if (phonesMatch(row.phone_norm, phone)) {
      return Number(row.id);
    }
  }
  return null;
}

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

async function resolveUserIdFromHeader(request, phone) {
  const headerUserId = getHeaderUserId(request);
  if (!headerUserId) return null;

  if (phone) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    // Some older users may have NULL phone in DB; accept header user id in that case.
    if (!dbPhone) {
      console.warn(
        "[cart/clear] X-Auth-User-Id user has no phone in DB; accepting header user id",
        {
          headerUserId,
        },
      );
      return Number(rows[0].id);
    }

    if (!phonesMatch(dbPhone, phone)) {
      console.warn(
        "[cart/clear] Ignoring X-Auth-User-Id because phone mismatch",
        {
          headerUserId,
          dbPhone,
          phone,
        },
      );
      return null;
    }

    return Number(rows[0].id);
  }

  const rows =
    await sql`SELECT id FROM auth_users WHERE id = ${headerUserId} AND is_active = true`;
  if (rows.length === 0) return null;
  return Number(rows[0].id);
}

async function tryGetJwtUserId(request) {
  let getToken;
  try {
    ({ getToken } = await import("@auth/core/jwt"));
  } catch (e) {
    console.error("[cart/clear] dynamic import @auth/core/jwt failed:", e);
    return null;
  }

  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: String(process.env.AUTH_URL || "").startsWith("https"),
    });

    if (jwt?.sub) {
      return Number(jwt.sub);
    }
  } catch (e) {
    console.error("[cart/clear] getToken error:", e);
  }

  return null;
}

// Clear entire cart
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { branch_id } = body;

    const headerPhoneRaw =
      request.headers.get("x-auth-phone") ||
      request.headers.get("X-Auth-Phone") ||
      request.headers.get("X-AUTH-PHONE");

    const phone = normalizePhone(body?.phone) || normalizePhone(headerPhoneRaw);

    let userId;

    // Auth priority: header user id (validated) -> phone -> bearer/cookie
    const headerResolved = await resolveUserIdFromHeader(request, phone);
    if (headerResolved) {
      userId = headerResolved;
    }

    if (!userId && phone) {
      const foundUserId = await findUserByPhone(phone);
      if (!foundUserId) {
        return corsJson(
          request,
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      userId = foundUserId;
    }

    if (!userId) {
      const jwtUserId = await tryGetJwtUserId(request);
      if (jwtUserId) {
        userId = jwtUserId;
      }
    }

    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!branch_id) {
      return corsJson(
        request,
        { error: "Branch ID is required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM cart_items 
      WHERE user_id = ${userId} AND branch_id = ${branch_id}
    `;

    return corsJson(request, { message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return corsJson(
      request,
      { error: "Failed to clear cart" },
      { status: 500 },
    );
  }
}
