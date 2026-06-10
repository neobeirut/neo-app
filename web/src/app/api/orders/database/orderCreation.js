import sql from "@/app/api/utils/sql";
import { normalizePromoCode } from "../utils/promoHelpers";

export async function createOrder({
  userId,
  totalAmount,
  order_type,
  scheduled_date,
  scheduled_time,
  delivery_address,
  address_id,
  special_instructions,
  effectiveBranchId,
  subtotalAmount,
  deliveryFee,
  discountAmount,
  appliedRewardId,
  appliedUserRewardId,
  pointsRedeemed,
  loyaltyBaseAmount,
  promo_code,
  promoDiscount,
  totalBeforeDiscount,
  deliveryDistanceKm,
  deliveryRuleId,
  freeDeliveryPeriodId,
  deliveryCostCalculationMethod,
}) {
  const promoCodeNorm = normalizePromoCode(promo_code);

  const [orderRow] = await sql`
    INSERT INTO orders (
      user_id,
      total_amount,
      status,
      order_type,
      scheduled_date,
      scheduled_time,
      delivery_address,
      address_id,
      special_instructions,
      branch_id,
      subtotal_amount,
      delivery_fee,
      discount_amount,
      applied_reward_id,
      applied_user_reward_id,
      points_redeemed,
      loyalty_base_amount,
      promo_code,
      promo_discount,
      total_before_discount,
      total_after_discount,
      delivery_distance_km,
      delivery_cost_at_order,
      delivery_rule_id,
      free_delivery_applied,
      free_delivery_period_id,
      delivery_cost_calculation_method
    ) VALUES (
      ${userId},
      ${totalAmount},
      'pending',
      ${order_type},
      ${scheduled_date},
      ${scheduled_time},
      ${delivery_address || ""},
      ${address_id || null},
      ${special_instructions || ""},
      ${effectiveBranchId},
      ${subtotalAmount},
      ${deliveryFee},
      ${discountAmount},
      ${appliedRewardId},
      ${appliedUserRewardId},
      ${pointsRedeemed || 0},
      ${loyaltyBaseAmount},
      ${promoCodeNorm || null},
      ${promoDiscount || 0},
      ${totalBeforeDiscount},
      ${totalAmount},
      ${deliveryDistanceKm || null},
      ${deliveryFee},
      ${deliveryRuleId || null},
      ${deliveryCostCalculationMethod === "free_period"},
      ${freeDeliveryPeriodId || null},
      ${deliveryCostCalculationMethod || null}
    ) RETURNING id
  `;

  return orderRow?.id || null;
}

export async function insertOrderItems({ createdOrderId, orderItems }) {
  for (const item of orderItems) {
    const [orderItemRow] = await sql`
      INSERT INTO order_items (
        order_id, product_id, quantity, unit_price, total_price, customizations, comment
      ) VALUES (
        ${createdOrderId}, ${item.product_id}, ${item.quantity},
        ${item.unit_price}, ${item.total_price}, ${JSON.stringify(item.customizations)}::jsonb,
        ${item.comment}
      ) RETURNING id
    `;

    const orderItemId = orderItemRow?.id;

    if (orderItemId && item.selected_addons.length > 0) {
      const addons = await sql`
        SELECT id, price
        FROM product_addons
        WHERE id = ANY(${item.selected_addons}) AND product_id = ${item.product_id}
      `;

      for (const addon of addons) {
        await sql`
          INSERT INTO order_item_addons (
            order_item_id, product_addon_id, quantity, price
          ) VALUES (
            ${orderItemId}, ${addon.id}, 1, ${addon.price}
          )
        `;
      }
    }
  }
}

export async function recordPromoRedemption({
  promoCodeId,
  promoCodeNorm,
  userId,
  createdOrderId,
  effectiveBranchId,
  subtotalAmount,
  promoDiscount,
}) {
  if (!promoCodeId || !promoCodeNorm || !promoDiscount || promoDiscount <= 0) {
    return;
  }

  await sql`
    INSERT INTO promo_redemptions (
      promo_code_id,
      code,
      user_id,
      order_id,
      branch,
      subtotal,
      discount_amount,
      currency,
      status
    ) VALUES (
      ${promoCodeId},
      ${promoCodeNorm},
      ${userId},
      ${createdOrderId},
      ${String(effectiveBranchId)},
      ${subtotalAmount},
      ${promoDiscount},
      'USD',
      'used'::promo_redemption_status
    )
  `;
}

export async function redeemPointsReward({
  userId,
  appliedRewardId,
  pointsRedeemed,
  createdOrderId,
}) {
  if (!appliedRewardId || !pointsRedeemed || pointsRedeemed <= 0) {
    return;
  }

  const [reward] = await sql`
    SELECT id, title, points_cost
    FROM rewards
    WHERE id = ${appliedRewardId}
  `;

  const redemptionCode = Math.random().toString(36).slice(2, 10).toUpperCase();

  await sql.transaction([
    sql`
      INSERT INTO user_reward_redemptions (
        user_id,
        reward_id,
        points_used,
        redemption_code,
        is_used,
        used_at,
        order_id
      ) VALUES (
        ${userId},
        ${appliedRewardId},
        ${pointsRedeemed},
        ${redemptionCode},
        true,
        CURRENT_TIMESTAMP,
        ${createdOrderId}
      )
    `,
    sql`
      UPDATE auth_users
      SET points = COALESCE(points, 0) - ${pointsRedeemed}
      WHERE id = ${userId}
    `,
    sql`
      INSERT INTO loyalty_transactions (
        user_id,
        transaction_type,
        points,
        description,
        related_order_id
      ) VALUES (
        ${userId},
        'redeemed',
        ${-pointsRedeemed},
        ${`Redeemed on order #${createdOrderId}: ${reward?.title || "Reward"}`},
        ${createdOrderId}
      )
    `,
  ]);
}
