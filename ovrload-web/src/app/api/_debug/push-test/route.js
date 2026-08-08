import sql from "@/app/api/utils/sql";

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

async function ensurePushTokensTable() {
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

async function getUserPushTokens(userId, legacyToken) {
  await ensurePushTokensTable();

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

  return {
    httpOk: response.ok,
    httpStatus: response.status,
    expo: expoData,
    ok: response.ok && expoStatus !== "error",
  };
}

export async function POST(request) {
  // Safety: keep this endpoint only for non-production environments
  if (String(process.env.ENV || "").toLowerCase() === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const headerUserId = getHeaderUserId(request);
  const userId = headerUserId ? Number(headerUserId) : null;

  if (!userId) {
    return Response.json(
      {
        error:
          "Authentication required (missing X-Auth-User-Id). Open this from the mobile app so headers are attached.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const title = body?.title ? String(body.title) : "Test notification";
  const msg = body?.body ? String(body.body) : "If you see this, push works ✅";

  const [user] = await sql`
    SELECT id, push_token
    FROM auth_users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!user?.id) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const tokens = await getUserPushTokens(userId, user?.push_token);

  if (tokens.length === 0) {
    return Response.json(
      {
        error: "No push tokens saved for this user",
        user_id: userId,
        tokens: [],
      },
      { status: 400 },
    );
  }

  const results = [];
  for (const token of tokens) {
    const r = await sendPushNotification(token, title, msg, {
      kind: "debug",
      ts: Date.now(),
    });
    results.push({ token: token.slice(0, 14) + "…", ...r });
  }

  return Response.json({ user_id: userId, tokens: tokens.length, results });
}
