import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

function safeNumber(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export async function GET() {
  try {
    const [tiers] = await sql`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'loyalty_tier_thresholds'
      LIMIT 1
    `;

    const [maxRewards] = await sql`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'checkout_max_rewards_per_order'
      LIMIT 1
    `;

    let thresholds = { Silver: 50, Gold: 200, Platinum: 500 };
    try {
      if (tiers?.setting_value) {
        const parsed = JSON.parse(String(tiers.setting_value));
        thresholds = {
          Silver: safeNumber(parsed?.Silver, 50),
          Gold: safeNumber(parsed?.Gold, 200),
          Platinum: safeNumber(parsed?.Platinum, 500),
        };
      }
    } catch (e) {
      // ignore
    }

    const maxRewardsPerOrder = safeNumber(maxRewards?.setting_value ?? 1, 1);

    return Response.json({ thresholds, maxRewardsPerOrder });
  } catch (error) {
    console.error("Error loading loyalty settings:", error);
    return Response.json(
      { error: "Failed to load loyalty settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const thresholds = body?.thresholds || {};

    const next = {
      Silver: safeNumber(thresholds?.Silver, 50),
      Gold: safeNumber(thresholds?.Gold, 200),
      Platinum: safeNumber(thresholds?.Platinum, 500),
    };

    // basic sanity
    if (next.Silver < 0) next.Silver = 0;
    if (next.Gold < next.Silver) next.Gold = next.Silver;
    if (next.Platinum < next.Gold) next.Platinum = next.Gold;

    const maxRewardsPerOrder = safeNumber(body?.maxRewardsPerOrder ?? 1, 1);
    const cappedMax = Math.min(Math.max(maxRewardsPerOrder, 1), 3);

    await sql.transaction([
      sql`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ('loyalty_tier_thresholds', ${JSON.stringify(next)})
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      `,
      sql`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ('checkout_max_rewards_per_order', ${String(cappedMax)})
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      `,
    ]);

    return Response.json({
      success: true,
      thresholds: next,
      maxRewardsPerOrder: cappedMax,
    });
  } catch (error) {
    console.error("Error saving loyalty settings:", error);
    return Response.json(
      { error: "Failed to save loyalty settings" },
      { status: 500 },
    );
  }
}
