import sql from "@/app/api/utils/sql";
import { createHmac } from "crypto";

// --- Admin token (simple signed token) ---
// Format: base64url(payloadJson).base64url(hmacSha256(payloadB64, AUTH_SECRET))
// Payload: { admin_user_id: number, iat: number, exp: number }

function base64UrlEncode(input) {
  const raw = Buffer.from(String(input), "utf8").toString("base64");
  return raw.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecodeToString(b64url) {
  const b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

function signAdminTokenPayload(payloadB64, secret) {
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64");
  return sig.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function createAdminToken({
  adminUserId,
  ttlSeconds = 60 * 60 * 24 * 30,
}) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    admin_user_id: Number(adminUserId),
    iat: now,
    exp: now + Number(ttlSeconds),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signAdminTokenPayload(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

function verifyAdminToken(token) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return null;
    }

    const parts = String(token || "").split(".");
    if (parts.length !== 2) {
      return null;
    }

    const [payloadB64, sig] = parts;
    const expectedSig = signAdminTokenPayload(payloadB64, secret);

    if (sig !== expectedSig) {
      return null;
    }

    const payloadJson = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(payloadJson);

    const adminUserId = Number.parseInt(String(payload?.admin_user_id), 10);
    const exp = Number.parseInt(String(payload?.exp), 10);
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isFinite(adminUserId) || !Number.isFinite(exp)) {
      return null;
    }

    if (exp <= now) {
      return null;
    }

    return { adminUserId };
  } catch (e) {
    console.error("[adminAuth] Failed to verify admin token", e);
    return null;
  }
}

export async function getAdminWithRolesFromRequest(request) {
  try {
    const tokenRaw =
      request.headers.get("x-admin-token") ||
      request.headers.get("X-Admin-Token");

    const verified = tokenRaw ? verifyAdminToken(tokenRaw) : null;

    // In production we require a token. In dev, allow the older x-admin-id header
    // so you don't get locked out if you have an old client.
    const allowInsecure = process.env.NODE_ENV !== "production";

    let adminId = verified?.adminUserId;

    if (!adminId && allowInsecure) {
      const adminIdRaw =
        request.headers.get("x-admin-id") || request.headers.get("X-Admin-Id");

      if (adminIdRaw) {
        const parsed = Number.parseInt(String(adminIdRaw), 10);
        if (Number.isFinite(parsed)) {
          adminId = parsed;
        }
      }
    }

    if (!adminId) {
      return null;
    }

    const [admin] = await sql`
      SELECT 
        au.id,
        au.name,
        au.email,
        au.branch_id,
        au.is_active,
        b.name as branch_name,
        ARRAY_AGG(aur.role) FILTER (WHERE aur.role IS NOT NULL) as roles
      FROM admin_users au
      LEFT JOIN branches b ON au.branch_id = b.id
      LEFT JOIN admin_user_roles aur ON au.id = aur.admin_user_id
      WHERE au.id = ${adminId} AND au.is_active = true
      GROUP BY au.id, au.name, au.email, au.branch_id, au.is_active, b.name
      LIMIT 1
    `;

    return admin || null;
  } catch (e) {
    console.error("[adminAuth] Failed to validate admin", e);
    return null;
  }
}

// Backwards compatible helper (older code imports this)
export async function getAdminFromRequest(request) {
  const admin = await getAdminWithRolesFromRequest(request);
  if (!admin) {
    return null;
  }
  // Return a minimal shape (existing callers only expect these fields)
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    branch_id: admin.branch_id,
    is_active: admin.is_active,
  };
}
