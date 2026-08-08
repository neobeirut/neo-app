import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";

export async function processPointsReward({
  request,
  applied_reward_id,
  userId,
  subtotalAmount,
}) {
  if (!applied_reward_id) {
    return {
      ok: true,
      discountAmount: 0,
      pointsRedeemed: 0,
      appliedRewardId: null,
      deliveryFeeOverride: null,
    };
  }

  const rewardId = Number.parseInt(String(applied_reward_id), 10);
  if (!Number.isFinite(rewardId)) {
    return {
      ok: false,
      response: corsJson(request, { error: "Invalid reward" }, { status: 400 }),
    };
  }

  const [reward] = await sql`
    SELECT id, title, points_cost, discount_amount, free_delivery, is_active
    FROM rewards
    WHERE id = ${rewardId} AND is_active = true
  `;

  if (!reward) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Reward not found or inactive" },
        { status: 404 },
      ),
    };
  }

  const [userRow] = await sql`
    SELECT points
    FROM auth_users
    WHERE id = ${userId}
  `;

  const currentPoints = Number(userRow?.points ?? 0);
  const requiredPoints = Number(reward.points_cost ?? 0);

  if (requiredPoints > 0 && currentPoints < requiredPoints) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Insufficient points",
          code: "INSUFFICIENT_POINTS",
          required: requiredPoints,
          current: currentPoints,
        },
        { status: 400 },
      ),
    };
  }

  const rewardDiscountRaw = reward.discount_amount;
  const rewardDiscount = rewardDiscountRaw
    ? Number.parseFloat(rewardDiscountRaw)
    : 0;

  let discountAmount = 0;
  if (Number.isFinite(rewardDiscount) && rewardDiscount > 0) {
    discountAmount = Math.min(subtotalAmount, rewardDiscount);
  }

  const deliveryFeeOverride = reward.free_delivery === true ? 0 : null;

  return {
    ok: true,
    discountAmount,
    pointsRedeemed: requiredPoints,
    appliedRewardId: reward.id,
    deliveryFeeOverride,
  };
}
