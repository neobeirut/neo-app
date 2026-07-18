import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rewardId } = await request.json();
    const userId = session.user.id;

    if (!rewardId) {
      return Response.json({ error: "Reward ID is required" }, { status: 400 });
    }

    // Get reward details
    const rewardResult = await sql`
      SELECT title, points_cost, is_active 
      FROM rewards 
      WHERE id = ${rewardId} AND is_active = true
    `;

    if (rewardResult.length === 0) {
      return Response.json(
        { error: "Reward not found or inactive" },
        { status: 404 },
      );
    }

    const reward = rewardResult[0];

    // Get user's current points
    const userResult = await sql`
      SELECT points FROM auth_users WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const currentPoints = userResult[0].points || 0;

    // Check if user has enough points
    if (currentPoints < reward.points_cost) {
      return Response.json(
        {
          error: "Insufficient points",
          required: reward.points_cost,
          current: currentPoints,
        },
        { status: 400 },
      );
    }

    // Generate unique redemption code
    const redemptionCode = Math.random()
      .toString(36)
      .substr(2, 8)
      .toUpperCase();

    // Process redemption
    await sql.transaction([
      // Create redemption record
      sql`
        INSERT INTO user_reward_redemptions (user_id, reward_id, points_used, redemption_code)
        VALUES (${userId}, ${rewardId}, ${reward.points_cost}, ${redemptionCode})
      `,
      // Deduct points from user
      sql`
        UPDATE auth_users 
        SET points = points - ${reward.points_cost}
        WHERE id = ${userId}
      `,
      // Add loyalty transaction
      sql`
        INSERT INTO loyalty_transactions (user_id, transaction_type, points, description)
        VALUES (${userId}, 'redeemed', ${-reward.points_cost}, ${"Redeemed: " + reward.title})
      `,
    ]);

    return Response.json({
      success: true,
      redemptionCode,
      pointsUsed: reward.points_cost,
      remainingPoints: currentPoints - reward.points_cost,
    });
  } catch (error) {
    console.error("Error redeeming reward:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
