import { auth } from "@/auth";
import {
  issueWelcomeRewardIfAllowed,
  markTierPopupSeen,
} from "@/app/api/utils/loyalty";
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
        "[loyalty/tier-upgrade] resolveUserId bearer getToken error:",
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
    const action = body?.action === "claim" ? "claim" : "dismiss";

    const [user] = await sql`
      SELECT membership_tier
      FROM auth_users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const tier = user?.membership_tier || "Bronze";

    if (tier !== "Silver" && tier !== "Platinum") {
      return corsJson(
        request,
        { error: "No tier welcome reward is available" },
        { status: 400 },
      );
    }

    // Mark seen regardless (so it doesn't show repeatedly)
    await markTierPopupSeen({ userId, tier });

    let issuedUserRewardId = null;
    if (action === "claim") {
      issuedUserRewardId = await issueWelcomeRewardIfAllowed({ userId, tier });
    }

    return corsJson(request, { success: true, tier, issuedUserRewardId });
  } catch (error) {
    console.error("Error handling tier upgrade popup:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
