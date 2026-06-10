import sql from "@/app/api/utils/sql";

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^0-9]/g, "");
  return cleaned || null;
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

async function resolveUserIdFromHeader(request, phoneNorm) {
  const headerUserId = getHeaderUserId(request);
  if (!headerUserId) return null;

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

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

async function tryGetJwtUserId(request) {
  let getToken;
  try {
    ({ getToken } = await import("@auth/core/jwt"));
  } catch (e) {
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
    return null;
  }

  return null;
}

async function resolveUserIdFromBody(request) {
  const body = await request.json().catch(() => ({}));

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phoneNorm =
    normalizePhone(body?.phone) || normalizePhone(headerPhoneRaw);

  const headerResolved = await resolveUserIdFromHeader(request, phoneNorm);
  if (headerResolved) {
    return { userId: headerResolved, body };
  }

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phoneNorm],
    );
    if (rows.length > 0) {
      return { userId: Number(rows[0].id), body };
    }
  }

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) {
    return { userId: jwtUserId, body };
  }

  return { userId: null, body };
}

async function ensurePushTokensTable() {
  // Non-destructive: create table if missing.
  // This lets us store token + platform + updatedAt as requested.
  await sql(`
    CREATE TABLE IF NOT EXISTS user_push_tokens (
      id bigserial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token text NOT NULL,
      platform text,
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      UNIQUE (user_id, token)
    )
  `);
}

// Save user's push notification token
export async function POST(request) {
  try {
    const { userId, body } = await resolveUserIdFromBody(request);

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { push_token, platform, updated_at } = body || {};

    if (!push_token) {
      return Response.json(
        { error: "Push token is required" },
        { status: 400 },
      );
    }

    await ensurePushTokensTable();

    const platformSafe = platform ? String(platform).slice(0, 32) : null;
    const updatedAtSafe = updated_at ? String(updated_at) : null;

    // Keep the legacy single-column value for backwards compatibility
    await sql`
      UPDATE auth_users 
      SET push_token = ${push_token}
      WHERE id = ${userId}
    `;

    // And also keep a history / per-platform store
    await sql(
      `
        INSERT INTO user_push_tokens (user_id, token, platform, updated_at)
        VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
        ON CONFLICT (user_id, token)
        DO UPDATE SET
          platform = EXCLUDED.platform,
          updated_at = EXCLUDED.updated_at
      `,
      [userId, String(push_token), platformSafe, updatedAtSafe],
    );

    return Response.json({
      message: "Push token saved successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error saving push token:", error);
    return Response.json(
      { error: "Failed to save push token", details: error.message },
      { status: 500 },
    );
  }
}

// NEW: debug-friendly endpoint so the mobile app (and you) can confirm what token(s)
// the backend actually has for the signed-in user.
export async function GET(request) {
  try {
    const { userId } = await resolveUserIdFromBody(request);

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const [user] = await sql`
      SELECT id, push_token
      FROM auth_users
      WHERE id = ${userId} AND is_active = true
      LIMIT 1
    `;

    await ensurePushTokensTable();

    const rows = await sql(
      "SELECT token, platform, updated_at FROM user_push_tokens WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10",
      [Number(userId)],
    );

    return Response.json({
      user_id: user?.id || userId,
      legacy_push_token: user?.push_token || null,
      tokens: rows || [],
    });
  } catch (error) {
    console.error("Error reading push tokens:", error);
    return Response.json(
      { error: "Failed to read push tokens", details: error.message },
      { status: 500 },
    );
  }
}
