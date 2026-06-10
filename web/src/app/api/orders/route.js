import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { reserveUserRewardForOrder } from "@/app/api/utils/loyalty";
import { resolveUserId } from "./utils/authHelpers";
import { normalizePhone } from "./utils/phoneHelpers";
import { normalizePromoCode } from "./utils/promoHelpers";
import { validateOrderBasics } from "./validation/orderValidation";
import { validateUserReward } from "./validation/rewardValidation";
import { validateDeliveryAddress } from "./validation/deliveryValidation";
import { validateAndApplyPromoCode } from "./validation/promoValidation";
import { validateScheduledTime } from "./validation/timeValidation";
import { processOrderItems } from "./processing/itemProcessing";
import { processPointsReward } from "./processing/rewardProcessing";
import { getDeliveryFee } from "./processing/deliveryFeeProcessing";
import {
  createOrder,
  insertOrderItems,
  recordPromoRedemption,
  redeemPointsReward,
} from "./database/orderCreation";
import { deductInventory } from "./database/inventoryUpdate";
import { getUserOrders } from "./database/orderRetrieval";
import {
  toLebanonE164,
  sendWhatsAppPayload,
} from "@/app/api/utils/customerWhatsApp";
import {
  getTemplateConfig,
  buildPayloadFromSchema,
} from "@/app/api/utils/whatsappTemplateRegistry";

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 CRITICAL CONSTANT - FORCED WHATSAPP SENDER (SAME AS CUSTOMER NOTIFICATIONS)
// ═══════════════════════════════════════════════════════════════════════════
const FORCED_WHATSAPP_SENDER = "96176489078";

// Send new order notification to branch via WhatsApp using "new_order_to_branch" template
async function sendNewOrderWhatsApp({ orderId, branchId }) {
  console.log(
    `[new_order_whatsapp] ==================== START ====================`,
  );
  console.log(
    `[new_order_whatsapp] Order ${orderId} created for branch ${branchId}`,
  );

  try {
    // Get branch info
    const [branch] = await sql`
      SELECT whatsapp_phone, phone, name
      FROM branches
      WHERE id = ${Number(branchId)}
      LIMIT 1
    `;

    if (!branch) {
      console.log(`[new_order_whatsapp] Branch ${branchId} not found`);
      return { ok: false, error: "Branch not found" };
    }

    const phoneRaw = branch.whatsapp_phone || branch.phone;

    if (!phoneRaw) {
      console.log(
        `[new_order_whatsapp] Branch ${branch.name} has no phone number configured`,
      );
      return { ok: false, error: "Branch has no phone number" };
    }

    // Normalize phone to E.164
    let branchPhone;
    try {
      branchPhone = toLebanonE164(phoneRaw);
      console.log(
        `[new_order_whatsapp] Branch phone normalized to: ${branchPhone}`,
      );
    } catch (error) {
      console.error(
        `[new_order_whatsapp] Invalid branch phone: ${phoneRaw}`,
        error,
      );
      return { ok: false, error: `Invalid branch phone: ${error.message}` };
    }

    // ═══════════════════════════════════════════════════════════════
    // SCHEMA-DRIVEN TEMPLATE PAYLOAD BUILD (Uses template registry)
    // ═══════════════════════════════════════════════════════════════

    // Get template configuration + schema from database
    const fullConfig = await getTemplateConfig("new_order_to_branch");

    if (!fullConfig || !fullConfig.templateName) {
      console.error(
        `[new_order_whatsapp] Template "new_order_to_branch" not configured in database`,
      );
      return {
        ok: false,
        error: "WhatsApp template not configured",
        hint: "Configure template in Admin Settings → WhatsApp Templates → new_order_to_branch",
      };
    }

    const { templateName, language, schema } = fullConfig;

    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 📤 SENDING NEW ORDER NOTIFICATION TO BRANCH                    ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(`║ Order ID:              ${String(orderId).padEnd(39)}║`);
    console.log(
      `║ Branch:                ${branch.name.substring(0, 39).padEnd(39)}║`,
    );
    console.log(`║ Branch Phone:          ${branchPhone.padEnd(39)}║`);
    console.log(`║ Template Name:         ${templateName.padEnd(39)}║`);
    console.log(`║ Language:              ${language.padEnd(39)}║`);
    console.log(
      `║ Sender:                ${FORCED_WHATSAPP_SENDER.padEnd(39)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ Schema:                                                        ║`,
    );
    console.log(
      `║   Body Placeholders:   ${String(schema.bodyPlaceholderCount).padEnd(39)}║`,
    );
    console.log(
      `║   Has Header:          ${String(schema.hasHeader).padEnd(39)}║`,
    );
    console.log(
      `║   Has Buttons:         ${String(schema.hasButtons).padEnd(39)}║`,
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // Build placeholders array based on schema requirements
    const placeholders = [];

    // If template expects placeholders, add orderId
    if (schema.bodyPlaceholderCount > 0) {
      placeholders.push(String(orderId));

      // Fill remaining placeholders with branch name if needed
      if (schema.bodyPlaceholderCount > 1) {
        placeholders.push(branch.name);
      }
    }

    // Build payload using schema-driven builder
    let payload;
    try {
      payload = buildPayloadFromSchema(
        schema,
        { templateName, language },
        {
          placeholders,
          buttonParams: [], // No buttons for branch notifications
          header: null, // No header for branch notifications
        },
        FORCED_WHATSAPP_SENDER,
        branchPhone,
      );

      console.log(
        `[new_order_whatsapp] ✅ Payload built successfully using schema`,
      );
      console.log(
        `[new_order_whatsapp] Payload:`,
        JSON.stringify(payload, null, 2),
      );
    } catch (buildError) {
      const errorMsg = `Failed to build payload: ${buildError.message}`;
      console.error(`[new_order_whatsapp] ${errorMsg}`);

      // Log to database
      await sql`
        INSERT INTO whatsapp_logs (
          order_id, branch_id, to_phone, message_text, status, error
        ) VALUES (
          ${Number(orderId)},
          ${Number(branchId)},
          ${branchPhone},
          '[Template: ${templateName}] New order #${orderId}',
          'failed',
          ${errorMsg}
        )
      `.catch((e) =>
        console.error("[new_order_whatsapp] Failed to log error", e),
      );

      return {
        ok: false,
        error: errorMsg,
      };
    }

    // Send via Infobip
    try {
      const response = await sendWhatsAppPayload(payload);

      console.log(
        `[new_order_whatsapp] ✅ WhatsApp sent successfully to branch ${branch.name}`,
      );
      console.log(`[new_order_whatsapp] Message ID: ${response.id}`);

      // Log to whatsapp_logs table
      await sql`
        INSERT INTO whatsapp_logs (
          order_id, branch_id, to_phone, message_text, status, provider_message_id
        ) VALUES (
          ${Number(orderId)},
          ${Number(branchId)},
          ${branchPhone},
          '[Template: ${templateName}] New order #${orderId}',
          'sent',
          ${response.id || null}
        )
      `;

      console.log(
        `[new_order_whatsapp] ==================== SUCCESS ====================`,
      );

      return {
        ok: true,
        sent: true,
        messageId: response.id,
        templateName,
        branchPhone,
      };
    } catch (sendError) {
      const errorMsg = String(sendError?.message || sendError);
      console.error(
        `[new_order_whatsapp] Send failed for order ${orderId}`,
        sendError,
      );

      // Log failure
      await sql`
        INSERT INTO whatsapp_logs (
          order_id, branch_id, to_phone, message_text, status, error
        ) VALUES (
          ${Number(orderId)},
          ${Number(branchId)},
          ${branchPhone},
          '[Template: ${templateName}] New order #${orderId}',
          'failed',
          ${errorMsg}
        )
      `.catch((e) =>
        console.error("[new_order_whatsapp] Failed to log error", e),
      );

      console.log(
        `[new_order_whatsapp] ==================== FAILED ====================`,
      );

      return {
        ok: false,
        error: `WhatsApp send failed: ${errorMsg}`,
      };
    }
  } catch (error) {
    console.error("[new_order_whatsapp] Unexpected error:", error);
    return {
      ok: false,
      error: String(error?.message || error),
    };
  }
}

export async function OPTIONS(request) {
  return corsOptions(request);
}

// Create a new order
export async function POST(request) {
  let createdOrderId = null;

  try {
    const {
      items,
      order_type,
      scheduled_date,
      scheduled_time,
      delivery_address,
      address_id,
      special_instructions,
      branch_id,
      phone,
      applied_reward_id,
      applied_user_reward_id,
      promo_code,
    } = await request.json();

    const userId = await resolveUserId(request, phone);

    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Validate basic order requirements
    const basicValidation = validateOrderBasics({
      request,
      items,
      order_type,
      scheduled_date,
      scheduled_time,
      branch_id,
      applied_reward_id,
      applied_user_reward_id,
    });

    if (!basicValidation.ok) {
      return basicValidation.response;
    }

    // Validate scheduled time is within operational hours and not in the past
    const timeValidation = await validateScheduledTime({
      request,
      scheduled_date,
      scheduled_time,
      order_type,
      branch_id,
    });

    if (!timeValidation.ok) {
      return timeValidation.response;
    }

    // Validate user reward (tier/perk)
    const userRewardValidation = await validateUserReward({
      request,
      applied_user_reward_id,
      userId,
    });

    if (!userRewardValidation.ok) {
      return userRewardValidation.response;
    }

    const appliedUserRewardId = userRewardValidation.appliedUserRewardId;
    const effectiveBranchId = branch_id;

    // Validate delivery address
    const deliveryValidation = await validateDeliveryAddress({
      request,
      order_type,
      address_id,
      userId,
      effectiveBranchId,
    });

    if (!deliveryValidation.ok) {
      return deliveryValidation.response;
    }

    // Process order items and calculate subtotal
    const itemsResult = await processOrderItems({
      request,
      items,
      effectiveBranchId,
    });

    if (!itemsResult.ok) {
      return itemsResult.response;
    }

    const { subtotalAmount, orderItems, inventoryDeductions } = itemsResult;

    // Get delivery fee with distance-based pricing
    const deliveryInfo = await getDeliveryFee(order_type, {
      addressId: address_id,
      branchId: effectiveBranchId,
    });

    // Check if address is outside delivery zone
    if (!deliveryInfo.inDeliveryZone) {
      return corsJson(
        request,
        {
          error: "Address is outside our delivery zone",
          maxDeliveryDistance: deliveryInfo.maxDeliveryDistance,
          actualDistance: deliveryInfo.distanceKm,
        },
        { status: 400 },
      );
    }

    let deliveryFee = deliveryInfo.fee;

    // Process points reward
    const rewardResult = await processPointsReward({
      request,
      applied_reward_id,
      userId,
      subtotalAmount,
    });

    if (!rewardResult.ok) {
      return rewardResult.response;
    }

    let {
      discountAmount,
      pointsRedeemed,
      appliedRewardId,
      deliveryFeeOverride,
    } = rewardResult;

    if (deliveryFeeOverride !== null) {
      deliveryFee = deliveryFeeOverride;
    }

    // Validate and apply promo code
    const promoResult = await validateAndApplyPromoCode({
      request,
      promo_code,
      userId,
      branch_id,
      subtotalAmount,
      orderItems,
    });

    if (!promoResult.ok) {
      return promoResult.response;
    }

    const { promoDiscount, promoCodeId } = promoResult;
    const promoCodeNorm = normalizePromoCode(promo_code);

    // Calculate final amounts
    const combinedDiscount = Math.min(
      subtotalAmount,
      Math.max(discountAmount, 0) + Math.max(promoDiscount, 0),
    );

    const loyaltyBaseAmount = Math.max(subtotalAmount - combinedDiscount, 0);
    const totalAmount = Math.max(loyaltyBaseAmount + deliveryFee, 0);
    const totalBeforeDiscount = Math.max(subtotalAmount + deliveryFee, 0);

    // Create order with delivery distance and cost information
    createdOrderId = await createOrder({
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
      deliveryDistanceKm: deliveryInfo.distanceKm,
      deliveryRuleId: deliveryInfo.deliveryRuleId,
      freeDeliveryPeriodId: deliveryInfo.freeDeliveryPeriodId,
      deliveryCostCalculationMethod: deliveryInfo.calculationMethod,
    });

    if (!createdOrderId) {
      throw new Error("Failed to create order");
    }

    // Record promo redemption
    try {
      await recordPromoRedemption({
        promoCodeId,
        promoCodeNorm,
        userId,
        createdOrderId,
        effectiveBranchId,
        subtotalAmount,
        promoDiscount,
      });
    } catch (e) {
      console.error("[orders] promo redemption insert failed", e);
      await sql`DELETE FROM orders WHERE id = ${createdOrderId}`;
      createdOrderId = null;

      return corsJson(
        request,
        { error: "Failed to apply promo code" },
        { status: 500 },
      );
    }

    // Reserve tier/perk reward
    if (appliedUserRewardId) {
      const result = await reserveUserRewardForOrder({
        userId,
        userRewardId: appliedUserRewardId,
        orderId: createdOrderId,
      });

      if (!result.ok) {
        await sql`DELETE FROM orders WHERE id = ${createdOrderId}`;
        createdOrderId = null;

        return corsJson(
          request,
          {
            error: result.message || "Reward could not be applied",
            code: result.code,
          },
          { status: 400 },
        );
      }
    }

    // Insert order items
    await insertOrderItems({ createdOrderId, orderItems });

    // Deduct inventory
    const inventoryResult = await deductInventory({
      request,
      inventoryDeductions,
      effectiveBranchId,
    });

    if (!inventoryResult.ok) {
      return inventoryResult.response;
    }

    // Redeem points reward
    await redeemPointsReward({
      userId,
      appliedRewardId,
      pointsRedeemed,
      createdOrderId,
    });

    // Send new order WhatsApp notification to branch (non-blocking)
    sendNewOrderWhatsApp({
      orderId: createdOrderId,
      branchId: effectiveBranchId,
    }).catch((err) => {
      console.error("[new_order_whatsapp] Async error:", err);
    });

    return corsJson(request, {
      message: "Order created successfully",
      order_id: createdOrderId,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      promo_code: promoCodeNorm || null,
      promo_discount: promoDiscount || 0,
      delivery_fee: deliveryFee,
      delivery_distance_km: deliveryInfo.distanceKm,
      is_free_delivery: deliveryInfo.calculationMethod === "free_period",
      loyalty_base_amount: loyaltyBaseAmount,
      total_before_discount: totalBeforeDiscount,
      total_after_discount: totalAmount,
      total_amount: totalAmount,
      points_redeemed: pointsRedeemed,
      points_awarded: 0,
      applied_user_reward_id: appliedUserRewardId,
      ...(deliveryValidation?.deliveryValidation?.ok
        ? {
            deliveryValidation: {
              isDeliverable:
                deliveryValidation.deliveryValidation.isDeliverable,
              branch: deliveryValidation.deliveryValidation.branch
                ? {
                    id: deliveryValidation.deliveryValidation.branch.id,
                    name: deliveryValidation.deliveryValidation.branch.name,
                    distanceKm:
                      deliveryValidation.deliveryValidation.branch
                        .distanceKm === null ||
                      deliveryValidation.deliveryValidation.branch
                        .distanceKm === undefined
                        ? null
                        : Number(
                            deliveryValidation.deliveryValidation.branch.distanceKm.toFixed(
                              3,
                            ),
                          ),
                    deliveryRadiusKm: Number(
                      deliveryValidation.deliveryValidation.branch
                        .deliveryRadiusKm,
                    ),
                  }
                : null,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("Error creating order:", error);

    if (createdOrderId) {
      try {
        await sql`DELETE FROM orders WHERE id = ${createdOrderId}`;
      } catch (cleanupError) {
        console.error("Error cleaning up failed order:", cleanupError);
      }
    }

    return corsJson(
      request,
      { error: "Failed to create order", details: error.message },
      { status: 500 },
    );
  }
}

// Get user's orders
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = normalizePhone(searchParams.get("phone"));

    const userId = await resolveUserId(request, phone);

    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const orders = await getUserOrders(userId);

    return corsJson(request, { orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return corsJson(
      request,
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
