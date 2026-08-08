import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { getToken } from "@auth/core/jwt";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

async function resolveUserId(request) {
  const session = await auth();
  if (session?.user?.id) return Number(session.user.id);

  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");

  if (authHeader) {
    try {
      const jwt = await getToken({
        req: { headers: { authorization: authHeader } },
        secret: process.env.AUTH_SECRET,
        secureCookie: String(process.env.AUTH_URL || "").startsWith("https"),
      });

      if (jwt?.sub) return Number(jwt.sub);
    } catch (e) {
      console.error(
        "[loyalty/how-it-works] resolveUserId bearer getToken error:",
        e,
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (phone) {
    const [row] = await sql`
      SELECT id FROM auth_users
      WHERE phone = ${phone} AND is_active = true
      LIMIT 1
    `;

    if (row?.id) return Number(row.id);
  }

  return null;
}

export async function POST(request) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const doNotShow = body?.doNotShow === true;

    if (!doNotShow) {
      return corsJson(request, { success: true, updated: false });
    }

    // Store on the user so it persists across devices.
    await sql(
      `UPDATE auth_users
       SET tier_upgrade_popup_seen = COALESCE(tier_upgrade_popup_seen, '{}'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify({ howItWorks: new Date().toISOString() }), userId],
    );

    return corsJson(request, { success: true, updated: true });
  } catch (error) {
    console.error("Error saving how-it-works preference:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
