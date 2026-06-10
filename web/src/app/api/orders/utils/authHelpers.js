import sql from "@/app/api/utils/sql";
import { normalizePhone } from "./phoneHelpers";

export function getHeaderUserId(request) {
  const raw =
    request.headers.get("x-auth-user-id") ||
    request.headers.get("X-Auth-User-Id") ||
    request.headers.get("X-AUTH-USER-ID");

  if (!raw) return null;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function resolveUserIdFromHeader(request, phoneNorm) {
  const headerUserId = getHeaderUserId(request);
  if (!headerUserId) return null;

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    // Older users may have NULL phone in DB; accept header user id in that case.
    if (!dbPhone) {
      return Number(rows[0].id);
    }

    if (dbPhone !== phoneNorm) {
      return null;
    }

    return Number(rows[0].id);
  }

  const rows =
    await sql`SELECT id FROM auth_users WHERE id = ${headerUserId} AND is_active = true`;
  if (rows.length === 0) return null;
  return Number(rows[0].id);
}

export async function tryGetJwtUserId(request) {
  // Dynamic import so this route keeps working even if @auth/core/jwt breaks in some runtimes.
  let getToken;
  try {
    ({ getToken } = await import("@auth/core/jwt"));
  } catch (e) {
    console.error("[orders] dynamic import @auth/core/jwt failed:", e);
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
    console.error("[orders] getToken error:", e);
  }

  return null;
}

export async function resolveUserId(request, phone) {
  const { searchParams } = new URL(request.url);

  const phoneRaw = phone || searchParams.get("phone");

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phoneNorm = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);

  // Best path for mobile phone-auth
  const headerResolved = await resolveUserIdFromHeader(request, phoneNorm);
  if (headerResolved) {
    return headerResolved;
  }

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phoneNorm],
    );
    if (rows.length > 0) return Number(rows[0].id);
  }

  // Web cookie JWT fallback
  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) return jwtUserId;

  return null;
}
