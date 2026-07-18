import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import {
  computeTierProgress,
  ensurePerksForUser,
  getTierThresholds,
  getUserRewardsForUser,
  hasSeenTierPopup,
  applyTierLock,
  computeTierFromTotalSpent,
  lockUntilMonthsFromNowDate,
} from "@/app/api/utils/loyalty";

export async function OPTIONS(request) {
  return corsOptions(request);
}

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
    console.error("[loyalty/points] dynamic import @auth/core/jwt failed:", e);
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
    console.error("[loyalty/points] getToken error:", e);
  }

  return null;
}

async function resolveUserId(request) {
  const { searchParams } = new URL(request.url);

  const phoneRaw = searchParams.get("phone");

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phoneNorm = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);

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

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) return jwtUserId;

  return null;
}

export async function GET(request) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const userResult = await sql`
      SELECT points, membership_tier, total_spent, birthday, tier_locked_until, tier_upgrade_popup_seen
      FROM auth_users
      WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return corsJson(request, { error: "User not found" }, { status: 404 });
    }

    const user = userResult[0];
    const currentPoints = Number(user.points ?? 0);

    const thresholds = await getTierThresholds();

    // Keep lifetime spend accurate (used for display), but tiers are driven by points.
    const [spentRow] = await sql`
      SELECT
        COALESCE(
          SUM(
            COALESCE(
              loyalty_base_amount,
              (total_amount - COALESCE(delivery_fee, 0))
            )
          ),
          0
        ) AS total_spent
      FROM orders
      WHERE user_id = ${userId}
        AND status = 'completed'
    `;

    const derivedTotalSpent =
      Number.parseFloat(spentRow?.total_spent ?? 0) || 0;

    const storedTotalSpent = Number(user.total_spent ?? 0);
    const storedTotalSpentSafe = Number.isFinite(storedTotalSpent)
      ? storedTotalSpent
      : 0;

    const totalSpent = derivedTotalSpent;

    if (Math.abs(storedTotalSpentSafe - derivedTotalSpent) > 0.01) {
      await sql`
        UPDATE auth_users
        SET total_spent = ${derivedTotalSpent}
        WHERE id = ${userId}
      `;
    }

    // TIER LOGIC: based on points thresholds
    const currentTier = user.membership_tier || "Bronze";
    const computedTier = computeTierFromTotalSpent(currentPoints, thresholds);

    const lockResult = applyTierLock({
      currentTier,
      currentTierLockedUntil: user.tier_locked_until || null,
      computedTier,
    });

    const finalTier = lockResult.finalTier;

    let nextLockedUntil = user.tier_locked_until || null;
    if (lockResult.upgraded) {
      // Lock for 12 months from the date they reached the tier.
      nextLockedUntil = lockUntilMonthsFromNowDate(new Date(), 12)
        .toISOString()
        .slice(0, 10);
    }

    if (finalTier !== currentTier || (lockResult.upgraded && nextLockedUntil)) {
      await sql`
        UPDATE auth_users
        SET membership_tier = ${finalTier}, tier_locked_until = ${nextLockedUntil}
        WHERE id = ${userId}
      `;
    }

    const membershipTier = finalTier;

    await ensurePerksForUser({
      userId,
      tier: membershipTier,
      birthday: user.birthday,
    });

    // Tier progress is also based on points (not spend)
    const tierProgress = computeTierProgress({
      tier: membershipTier,
      totalSpent: currentPoints,
      thresholds,
    });

    const userRewards = await getUserRewardsForUser(userId);

    let tierUpgradePopup = null;
    if (membershipTier === "Silver" || membershipTier === "Platinum") {
      const seen = await hasSeenTierPopup({ userId, tier: membershipTier });

      const [existingWelcome] = await sql`
        SELECT ur.id
        FROM user_rewards ur
        JOIN rewards_catalog rc ON rc.id = ur.catalog_id
        WHERE ur.user_id = ${userId}
          AND ur.source = 'welcome'
          AND rc.code = ${membershipTier === "Platinum" ? "WELCOME_PLATINUM" : "WELCOME_SILVER"}
        LIMIT 1
      `;

      if (!seen && !existingWelcome) {
        tierUpgradePopup = {
          tier: membershipTier,
          title:
            membershipTier === "Platinum"
              ? "Welcome to Platinum"
              : "Welcome to Silver",
          message:
            membershipTier === "Platinum"
              ? "You just unlocked Platinum. Claim your welcome treat (expires in 7 days)."
              : "You just unlocked Silver. Claim your welcome reward (expires in 7 days).",
        };
      }
    }

    const transactions = await sql`
      SELECT 
        id,
        transaction_type,
        points,
        description,
        created_at
      FROM loyalty_transactions 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC 
      LIMIT 10
    `;

    const seenMap = user?.tier_upgrade_popup_seen || {};
    const howItWorksDismissed = !!seenMap?.howItWorks;

    return corsJson(request, {
      currentPoints: user.points || 0,
      membershipTier,
      totalSpent,
      tierProgress,
      thresholds,
      userRewards,
      tierUpgradePopup,
      recentActivity: transactions,
      tierBasis: "points",
      howItWorksDismissed,
    });
  } catch (error) {
    console.error("Error fetching loyalty points:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const {
      points,
      description,
      transaction_type = "earned",
      related_order_id,
      userId,
    } = await request.json();

    const targetUserId = Number(userId);

    if (!Number.isFinite(targetUserId)) {
      return corsJson(
        request,
        { error: "Valid userId is required" },
        { status: 400 },
      );
    }

    const pointsNum = Number(points);

    if (!Number.isFinite(pointsNum) || !description) {
      return corsJson(
        request,
        { error: "Points and description are required" },
        { status: 400 },
      );
    }

    await sql.transaction([
      sql`
        INSERT INTO loyalty_transactions (user_id, transaction_type, points, description, related_order_id)
        VALUES (${targetUserId}, ${transaction_type}, ${pointsNum}, ${description}, ${related_order_id})
      `,
      sql`
        UPDATE auth_users 
        SET points = COALESCE(points, 0) + ${pointsNum}
        WHERE id = ${targetUserId}
      `,
    ]);

    // Recompute tier based on updated points (and apply lock rules)
    const thresholds = await getTierThresholds();
    const [user] = await sql`
      SELECT points, membership_tier, tier_locked_until
      FROM auth_users
      WHERE id = ${targetUserId}
    `;

    const currentTier = user?.membership_tier || "Bronze";
    const computedTier = computeTierFromTotalSpent(
      Number(user?.points ?? 0),
      thresholds,
    );

    const lockResult = applyTierLock({
      currentTier,
      currentTierLockedUntil: user?.tier_locked_until || null,
      computedTier,
    });

    let nextLockedUntil = user?.tier_locked_until || null;
    if (lockResult.upgraded) {
      nextLockedUntil = lockUntilMonthsFromNowDate(new Date(), 12)
        .toISOString()
        .slice(0, 10);
    }

    if (
      lockResult.finalTier !== currentTier ||
      (lockResult.upgraded && nextLockedUntil)
    ) {
      await sql`
        UPDATE auth_users
        SET membership_tier = ${lockResult.finalTier}, tier_locked_until = ${nextLockedUntil}
        WHERE id = ${targetUserId}
      `;
    }

    return corsJson(request, { success: true });
  } catch (error) {
    console.error("Error updating loyalty points:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
