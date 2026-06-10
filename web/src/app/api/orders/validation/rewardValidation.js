import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";

export async function validateUserReward({
  request,
  applied_user_reward_id,
  userId,
}) {
  if (!applied_user_reward_id) {
    return { ok: true, appliedUserRewardId: null };
  }

  const userRewardId = String(applied_user_reward_id).trim();
  if (!userRewardId) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Invalid user reward" },
        { status: 400 },
      ),
    };
  }

  const [userReward] = await sql`
    SELECT id, status, expires_at
    FROM user_rewards
    WHERE id = ${userRewardId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!userReward) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Reward not found", code: "USER_REWARD_NOT_FOUND" },
        { status: 404 },
      ),
    };
  }

  if (userReward.expires_at && new Date(userReward.expires_at) < new Date()) {
    await sql`
      UPDATE user_rewards
      SET status = 'expired'
      WHERE id = ${userRewardId}
    `;

    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Reward expired", code: "USER_REWARD_EXPIRED" },
        { status: 400 },
      ),
    };
  }

  if (String(userReward.status) !== "available") {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Reward is not available",
          code: "USER_REWARD_NOT_AVAILABLE",
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, appliedUserRewardId: userReward.id };
}
