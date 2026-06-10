import sql from "@/app/api/utils/sql";

const DEFAULT_THRESHOLDS = {
  Silver: 50,
  Gold: 200,
  Platinum: 500,
};

export async function getTierThresholds() {
  try {
    const [row] = await sql`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'loyalty_tier_thresholds'
      LIMIT 1
    `;

    if (!row?.setting_value) {
      return DEFAULT_THRESHOLDS;
    }

    const parsed = JSON.parse(String(row.setting_value));
    const next = {
      Silver: Number(parsed?.Silver ?? DEFAULT_THRESHOLDS.Silver),
      Gold: Number(parsed?.Gold ?? DEFAULT_THRESHOLDS.Gold),
      Platinum: Number(parsed?.Platinum ?? DEFAULT_THRESHOLDS.Platinum),
    };

    if (!Number.isFinite(next.Silver) || next.Silver < 0) next.Silver = 50;
    if (!Number.isFinite(next.Gold) || next.Gold < next.Silver) next.Gold = 200;
    if (!Number.isFinite(next.Platinum) || next.Platinum < next.Gold)
      next.Platinum = 500;

    return next;
  } catch (e) {
    console.error("getTierThresholds error:", e);
    return DEFAULT_THRESHOLDS;
  }
}

export function computeTierFromTotalSpent(totalSpent, thresholds) {
  const spent = Number(totalSpent ?? 0);
  const value = Number.isFinite(spent) ? spent : 0;

  if (value >= thresholds.Platinum) return "Platinum";
  if (value >= thresholds.Gold) return "Gold";
  if (value >= thresholds.Silver) return "Silver";
  return "Bronze";
}

function tierRank(tier) {
  if (tier === "Platinum") return 4;
  if (tier === "Gold") return 3;
  if (tier === "Silver") return 2;
  return 1;
}

export function applyTierLock({
  currentTier,
  currentTierLockedUntil,
  computedTier,
  nowDate,
}) {
  const now = nowDate || new Date();
  const lockDate = currentTierLockedUntil
    ? new Date(currentTierLockedUntil)
    : null;

  const current = currentTier || "Bronze";
  const computed = computedTier || "Bronze";

  const currentRank = tierRank(current);
  const computedRank = tierRank(computed);

  const lockActive =
    lockDate && !Number.isNaN(lockDate.getTime())
      ? lockDate >= new Date(now.toISOString().slice(0, 10))
      : false;

  // No downgrades while lock is active
  if (lockActive && computedRank < currentRank) {
    return { finalTier: current, upgraded: false, downgraded: false };
  }

  if (computedRank > currentRank) {
    return { finalTier: computed, upgraded: true, downgraded: false };
  }

  if (computedRank < currentRank) {
    return { finalTier: computed, upgraded: false, downgraded: true };
  }

  return { finalTier: current, upgraded: false, downgraded: false };
}

export function lockUntilMonthsFromNowDate(nowDate, months) {
  const now = nowDate ? new Date(nowDate) : new Date();
  const m = Number(months ?? 12);
  const safeMonths = Number.isFinite(m) && m > 0 ? m : 12;

  // Use UTC months so it behaves consistently across environments.
  const next = new Date(now);
  next.setUTCMonth(next.getUTCMonth() + safeMonths);
  return next;
}

export function endOfCurrentYearDate(nowDate) {
  const now = nowDate || new Date();
  const y = now.getFullYear();
  return new Date(Date.UTC(y, 11, 31));
}

function getPeriodKey({ frequency, nowDate }) {
  const now = nowDate || new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");

  if (frequency === "monthly") return `${y}-${m}`;

  if (frequency === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${y}-Q${q}`;
  }

  if (frequency === "yearly_birthday") return `${y}`;

  return `${y}`;
}

function computeExpiresAt({ nowDate, expiresDays }) {
  const now = nowDate || new Date();
  const days = Number(expiresDays ?? 0);
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

async function expireUserRewardsIfNeeded(userId) {
  await sql`
    UPDATE user_rewards
    SET status = 'expired'
    WHERE user_id = ${userId}
      AND status IN ('available','reserved')
      AND expires_at IS NOT NULL
      AND expires_at < now()
  `;
}

async function issueUserRewardIfMissing({
  userId,
  catalogId,
  periodKey,
  source,
  expiresAt,
  metadata,
}) {
  const expiresValue = expiresAt ? new Date(expiresAt) : null;
  const meta = metadata ? JSON.stringify(metadata) : "{}";

  // ON CONFLICT uses unique index (user_id, catalog_id, period_key)
  const rows = await sql`
    INSERT INTO user_rewards (
      user_id,
      catalog_id,
      status,
      source,
      period_key,
      expires_at,
      metadata
    ) VALUES (
      ${userId},
      ${catalogId},
      'available',
      ${source},
      ${periodKey},
      ${expiresValue},
      ${meta}::jsonb
    )
    ON CONFLICT (user_id, catalog_id, period_key)
    DO NOTHING
    RETURNING id
  `;

  return rows?.[0]?.id || null;
}

function isBirthdayToday({ birthday, nowDate }) {
  if (!birthday) return false;
  const now = nowDate || new Date();
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return false;

  return (
    b.getUTCDate() === now.getUTCDate() && b.getUTCMonth() === now.getUTCMonth()
  );
}

export async function ensurePerksForUser({ userId, tier, birthday, nowDate }) {
  const now = nowDate || new Date();

  await expireUserRewardsIfNeeded(userId);

  // Load active catalog entries once.
  const catalog = await sql`
    SELECT id, code, title, description, tier_required, frequency, expires_days, is_active
    FROM rewards_catalog
    WHERE is_active = true
  `;

  const byCode = new Map(catalog.map((c) => [c.code, c]));

  // Birthday rewards
  if (isBirthdayToday({ birthday, nowDate: now })) {
    const isSilverOrAbove =
      tier === "Silver" || tier === "Gold" || tier === "Platinum";
    const code = isSilverOrAbove ? "BIRTHDAY_SILVER" : "BIRTHDAY_BRONZE";
    const entry = byCode.get(code);

    if (entry) {
      const periodKey = `birthday-${getPeriodKey({ frequency: "yearly_birthday", nowDate: now })}`;
      const expiresAt = computeExpiresAt({
        nowDate: now,
        expiresDays: entry.expires_days ?? 7,
      });
      await issueUserRewardIfMissing({
        userId,
        catalogId: entry.id,
        periodKey,
        source: "perk",
        expiresAt,
        metadata: { kind: "birthday" },
      });
    }
  }

  // Monthly perks
  if (tier === "Platinum") {
    const entry = byCode.get("MONTHLY_PLATINUM");
    if (entry) {
      const periodKey = getPeriodKey({ frequency: "monthly", nowDate: now });
      const expiresAt = computeExpiresAt({
        nowDate: now,
        expiresDays: entry.expires_days ?? 30,
      });
      await issueUserRewardIfMissing({
        userId,
        catalogId: entry.id,
        periodKey,
        source: "perk",
        expiresAt,
        metadata: { kind: "monthly" },
      });
    }
  } else if (tier === "Silver" || tier === "Gold") {
    const entry = byCode.get("MONTHLY_SILVER");
    if (entry) {
      const periodKey = getPeriodKey({ frequency: "monthly", nowDate: now });
      const expiresAt = computeExpiresAt({
        nowDate: now,
        expiresDays: entry.expires_days ?? 30,
      });
      await issueUserRewardIfMissing({
        userId,
        catalogId: entry.id,
        periodKey,
        source: "perk",
        expiresAt,
        metadata: { kind: "monthly" },
      });
    }
  }

  // Quarterly perk (Platinum only)
  if (tier === "Platinum") {
    const entry = byCode.get("QUARTERLY_PLATINUM");
    if (entry) {
      const periodKey = getPeriodKey({ frequency: "quarterly", nowDate: now });
      const expiresAt = computeExpiresAt({
        nowDate: now,
        expiresDays: entry.expires_days ?? 90,
      });
      await issueUserRewardIfMissing({
        userId,
        catalogId: entry.id,
        periodKey,
        source: "perk",
        expiresAt,
        metadata: { kind: "quarterly" },
      });
    }
  }
}

export async function getUserRewardsForUser(userId) {
  await expireUserRewardsIfNeeded(userId);

  const rows = await sql`
    SELECT
      ur.id,
      ur.status,
      ur.source,
      ur.period_key,
      ur.issued_at,
      ur.expires_at,
      ur.reserved_at,
      ur.redeemed_at,
      ur.order_id,
      rc.code as catalog_code,
      rc.title,
      rc.description,
      rc.tier_required,
      rc.frequency
    FROM user_rewards ur
    JOIN rewards_catalog rc ON ur.catalog_id = rc.id
    WHERE ur.user_id = ${userId}
    ORDER BY ur.issued_at DESC
    LIMIT 200
  `;

  const available = rows.filter((r) => r.status === "available");
  const history = rows.filter((r) => r.status !== "available");

  return { available, history };
}

export function computeTierProgress({ tier, totalSpent, thresholds }) {
  const spent = Number(totalSpent ?? 0);
  const v = Number.isFinite(spent) ? spent : 0;

  const order = [
    { name: "Bronze", threshold: 0 },
    { name: "Silver", threshold: thresholds.Silver },
    { name: "Gold", threshold: thresholds.Gold },
    { name: "Platinum", threshold: thresholds.Platinum },
  ];

  const currentIndex = order.findIndex((t) => t.name === tier);
  const next = currentIndex >= 0 ? order[currentIndex + 1] : null;

  if (!next) {
    return {
      currentTier: tier,
      nextTier: null,
      progressPct: 100,
      currentValue: v,
      nextThreshold: null,
      remainingToNext: 0,
    };
  }

  const currentThreshold = order[currentIndex]?.threshold ?? 0;
  const range = Math.max(next.threshold - currentThreshold, 1);
  const within = Math.max(v - currentThreshold, 0);
  const pct = Math.min((within / range) * 100, 100);

  return {
    currentTier: tier,
    nextTier: next.name,
    progressPct: pct,
    currentValue: v,
    nextThreshold: next.threshold,
    remainingToNext: Math.max(next.threshold - v, 0),
  };
}

export async function markTierPopupSeen({ userId, tier }) {
  // jsonb_set with dynamic key
  await sql(
    `UPDATE auth_users
     SET tier_upgrade_popup_seen = COALESCE(tier_upgrade_popup_seen, '{}'::jsonb) || $1::jsonb
     WHERE id = $2`,
    [JSON.stringify({ [tier]: new Date().toISOString() }), userId],
  );
}

export async function hasSeenTierPopup({ userId, tier }) {
  const [row] = await sql`
    SELECT tier_upgrade_popup_seen
    FROM auth_users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const seen = row?.tier_upgrade_popup_seen || {};
  return !!seen?.[tier];
}

export async function issueWelcomeRewardIfAllowed({ userId, tier }) {
  const code =
    tier === "Platinum"
      ? "WELCOME_PLATINUM"
      : tier === "Silver"
        ? "WELCOME_SILVER"
        : null;
  if (!code) return null;

  const [entry] = await sql`
    SELECT id, expires_days
    FROM rewards_catalog
    WHERE code = ${code} AND is_active = true
    LIMIT 1
  `;

  if (!entry?.id) return null;

  const periodKey = `welcome-${tier}`;
  const expiresAt = computeExpiresAt({
    nowDate: new Date(),
    expiresDays: entry.expires_days ?? 7,
  });

  const inserted = await issueUserRewardIfMissing({
    userId,
    catalogId: entry.id,
    periodKey,
    source: "welcome",
    expiresAt,
    metadata: { kind: "welcome", tier },
  });

  return inserted;
}

export async function reserveUserRewardForOrder({
  userId,
  userRewardId,
  orderId,
}) {
  const [row] = await sql`
    SELECT id, status, expires_at
    FROM user_rewards
    WHERE id = ${userRewardId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Reward not found" };
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await sql`
      UPDATE user_rewards
      SET status = 'expired'
      WHERE id = ${userRewardId}
    `;
    return { ok: false, code: "EXPIRED", message: "Reward expired" };
  }

  if (row.status !== "available") {
    return {
      ok: false,
      code: "NOT_AVAILABLE",
      message: "Reward is not available",
    };
  }

  await sql`
    UPDATE user_rewards
    SET status = 'reserved', reserved_at = now(), order_id = ${orderId}
    WHERE id = ${userRewardId} AND user_id = ${userId} AND status = 'available'
  `;

  return { ok: true };
}

export async function redeemOrReleaseUserRewardForOrder({ orderId, status }) {
  // status is the NEW order status
  const [order] = await sql`
    SELECT applied_user_reward_id
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;

  const userRewardId = order?.applied_user_reward_id;
  if (!userRewardId) return;

  if (status === "completed") {
    await sql`
      UPDATE user_rewards
      SET status = 'redeemed', redeemed_at = now()
      WHERE id = ${userRewardId} AND status = 'reserved'
    `;
  }

  if (status === "cancelled") {
    // Return to available if it was reserved (unless expired)
    await sql`
      UPDATE user_rewards
      SET status = 'available', reserved_at = NULL, order_id = NULL
      WHERE id = ${userRewardId}
        AND status = 'reserved'
        AND (expires_at IS NULL OR expires_at >= now())
    `;
  }
}
