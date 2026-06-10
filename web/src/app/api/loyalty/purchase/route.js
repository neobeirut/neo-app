import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import {
  applyTierLock,
  computeTierFromTotalSpent,
  getTierThresholds,
  lockUntilMonthsFromNowDate,
} from "@/app/api/utils/loyalty";

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, amount, description = "Purchase" } = await request.json();

    const targetUserId = Number(userId);

    if (!Number.isFinite(targetUserId)) {
      return Response.json(
        { error: "Valid userId is required" },
        { status: 400 },
      );
    }

    if (!amount || amount <= 0) {
      return Response.json(
        { error: "Valid purchase amount is required" },
        { status: 400 },
      );
    }

    // Calculate points (1 point per dollar)
    const pointsEarned = Math.floor(amount);

    await sql.transaction([
      // Add loyalty transaction
      sql`
        INSERT INTO loyalty_transactions (user_id, transaction_type, points, description)
        VALUES (${targetUserId}, 'earned', ${pointsEarned}, ${description + " - $" + amount.toFixed(2)})
      `,
      // Update user's total points and total spent
      sql`
        UPDATE auth_users 
        SET 
          points = COALESCE(points, 0) + ${pointsEarned},
          total_spent = COALESCE(total_spent, 0) + ${amount}
        WHERE id = ${targetUserId}
      `,
    ]);

    // Update membership tier based on total spent + tier lock
    const [userResult] = await sql`
      SELECT total_spent, membership_tier, tier_locked_until
      FROM auth_users
      WHERE id = ${targetUserId}
    `;

    const totalSpent = Number.parseFloat(userResult?.total_spent ?? 0) || 0;
    const thresholds = await getTierThresholds();
    const computedTier = computeTierFromTotalSpent(totalSpent, thresholds);

    const lockResult = applyTierLock({
      currentTier: userResult?.membership_tier || "Bronze",
      currentTierLockedUntil: userResult?.tier_locked_until || null,
      computedTier,
    });

    let nextLockedUntil = userResult?.tier_locked_until || null;
    if (lockResult.upgraded) {
      nextLockedUntil = lockUntilMonthsFromNowDate(new Date(), 12)
        .toISOString()
        .slice(0, 10);
    }

    await sql`
      UPDATE auth_users 
      SET membership_tier = ${lockResult.finalTier}, tier_locked_until = ${nextLockedUntil}
      WHERE id = ${targetUserId}
    `;

    return Response.json({
      success: true,
      pointsEarned,
      newTier: lockResult.finalTier,
      totalSpent: parseFloat(totalSpent),
    });
  } catch (error) {
    console.error("Error processing purchase:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
