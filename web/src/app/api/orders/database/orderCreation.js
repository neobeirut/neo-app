import sql from "@/app/api/utils/sql";
import { normalizePromoCode } from "../utils/promoHelpers";
import { generateOrderNumber } from "../utils/orderIdResolver";

export async function createOrder(params = {}) {
  const userId = params.userId ?? params.user_id ?? null;
  const effectiveBranchId = Number(params.effectiveBranchId ?? params.branch_id ?? 1);
  const order_type = params.order_type ?? params.orderType ?? "pickup";
  const scheduled_date = params.scheduled_date ?? params.scheduledDate ?? null;
  const scheduled_time = params.scheduled_time ?? params.scheduledTime ?? null;
  const delivery_address = params.delivery_address ?? params.deliveryAddress ?? "";
  const address_id = params.address_id ?? params.addressId ?? null;
  const special_instructions = params.special_instructions ?? params.specialInstructions ?? "";

  const subtotalAmount = Number(params.subtotalAmount ?? params.subtotal ?? 0);
  const deliveryFee = Number(params.deliveryFee ?? params.deliveryCost ?? 0);
  const discountAmount = Number(params.discountAmount ?? params.discount ?? 0);
  const promoDiscount = Number(params.promoDiscount ?? 0);
  const pointsRedeemed = Number(params.pointsRedeemed ?? 0);

  const combinedDiscount = Math.min(
    subtotalAmount,
    Math.max(discountAmount, 0) + Math.max(promoDiscount, 0),
  );
  const loyaltyBaseAmount = Math.max(subtotalAmount - combinedDiscount, 0);
  const totalAmount = Number(
    params.totalAmount ?? Math.max(loyaltyBaseAmount + deliveryFee, 0),
  );
  const totalBeforeDiscount = Number(
    params.totalBeforeDiscount ?? Math.max(subtotalAmount + deliveryFee, 0),
  );

  const appliedRewardId = params.appliedRewardId ?? params.applied_reward_id ?? null;
  const appliedUserRewardId = params.appliedUserRewardId ?? params.applied_user_reward_id ?? null;
  const promo_code = params.promo_code ?? params.promoCode ?? null;
  const promoCodeNorm = normalizePromoCode(promo_code);

  const deliveryDistanceKm = params.deliveryDistanceKm ?? params.distanceKm ?? null;
  const deliveryRuleId = params.deliveryRuleId ?? null;
  const freeDeliveryPeriodId = params.freeDeliveryPeriodId ?? null;
  const deliveryCostCalculationMethod =
    params.deliveryCostCalculationMethod ?? (order_type === "pickup" ? "pickup" : null);

  const orderNumber = await generateOrderNumber();

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
      delivery_cost_calculation_method,
      order_number
    ) VALUES (
      ${userId},
      ${totalAmount},
      'pending',
      ${order_type},
      ${scheduled_date},
      ${scheduled_time},
      ${delivery_address},
      ${address_id},
      ${special_instructions},
      ${effectiveBranchId},
      ${subtotalAmount},
      ${deliveryFee},
      ${discountAmount},
      ${appliedRewardId},
      ${appliedUserRewardId},
      ${pointsRedeemed},
      ${loyaltyBaseAmount},
      ${promoCodeNorm},
      ${promoDiscount},
      ${totalBeforeDiscount},
      ${totalAmount},
      ${deliveryDistanceKm ? String(deliveryDistanceKm) : null},
      ${deliveryFee},
      ${deliveryRuleId},
      ${deliveryCostCalculationMethod === "free_period"},
      ${freeDeliveryPeriodId},
      ${deliveryCostCalculationMethod},
      ${orderNumber}
    ) RETURNING id, order_number
  `;

  return {
    ok: true,
    id: orderRow?.id || null,
    orderNumber: orderRow?.order_number || null,
    createdOrderId: orderRow?.id || null,
    createdOrderNumber: orderRow?.order_number || null,
  };
}

export async function insertOrderItems({ createdOrderId, orderItems, processedItems }) {
  const items = orderItems || processedItems || [];
  const insertedItems = [];

  for (const item of items) {
    const customizationsVal = item.customizations
      ? typeof item.customizations === "string"
        ? item.customizations
        : JSON.stringify(item.customizations)
      : null;

    const [orderItemRow] = await sql`
      INSERT INTO order_items (
        order_id, product_id, quantity, unit_price, total_price, customizations, comment
      ) VALUES (
        ${createdOrderId},
        ${item.product_id ?? null},
        ${item.quantity ?? 1},
        ${item.unit_price ?? 0},
        ${item.total_price ?? 0},
        ${customizationsVal},
        ${item.comment ?? null}
      ) RETURNING id
    `;

    const orderItemId = orderItemRow?.id;
    if (orderItemId) {
      insertedItems.push({
        source_line_id: String(orderItemId),
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        name: item.name,
        customizations: item.customizations || [],
      });
    }

    const addonIds = Array.isArray(item.selected_addons)
      ? item.selected_addons.map(Number).filter(Number.isFinite)
      : [];

    if (orderItemId && addonIds.length > 0) {
      const addons = await sql`
        SELECT id, price
        FROM product_addons
        WHERE id = ANY(${addonIds}::int[]) AND product_id = ${item.product_id}
      `;

      for (const addon of addons) {
        await sql`
          INSERT INTO order_item_addons (
            order_item_id, product_addon_id, quantity, price
          ) VALUES (
            ${orderItemId},
            ${addon.id},
            1,
            ${addon.price ?? 0}
          )
        `;
      }
    }
  }

  return insertedItems;
}

export async function recordPromoRedemption({
  promoCodeId,
  promoCodeNorm,
  promoCode,
  userId,
  createdOrderId,
  effectiveBranchId,
  subtotalAmount,
  promoDiscount,
}) {
  const code = promoCodeNorm || normalizePromoCode(promoCode);
  if (!code || !promoDiscount || promoDiscount <= 0) {
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
      ${promoCodeId ?? null},
      ${code},
      ${userId ?? null},
      ${createdOrderId},
      ${String(effectiveBranchId ?? 1)},
      ${subtotalAmount ?? 0},
      ${promoDiscount ?? 0},
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
  if (!appliedRewardId || !pointsRedeemed || pointsRedeemed <= 0 || !userId) {
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
