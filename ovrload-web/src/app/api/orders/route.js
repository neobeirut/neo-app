import { resolveUserId } from "./utils/authHelpers";
import { processOrderItems } from "./processing/itemProcessing";
import { getDeliveryFee } from "./processing/deliveryFeeProcessing";
import {
  createOrder,
  insertOrderItems,
  recordPromoRedemption,
  redeemPointsReward,
} from "./database/orderCreation";
import { deductInventory } from "./database/inventoryUpdate";
import { getUserOrders } from "./database/orderRetrieval";
import { resolveOrderId } from "./utils/orderIdResolver";
import { sendAutomatedOrderWhatsAppMessages } from "@/app/api/utils/automatedOrderWhatsApp";
import {
  toLebanonE164,
  sendWhatsAppPayload,
  sendWhatsAppFreeForm,
} from "@/app/api/utils/customerWhatsApp";
import {
  getTemplateConfig,
  buildPayloadFromSchema,
} from "@/app/api/utils/whatsappTemplateRegistry";
import { sendPushNotificationToBranchAdmins } from "@/app/api/utils/pushNotification";
import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

// Send new order notification to branch via WhatsApp using "new_order_to_branch" template
async function sendNewOrderWhatsApp({ orderId, orderNumber, branchId }) {
  console.log(`[new_order_whatsapp] START for order #${orderNumber}`);
  try {
    const [order] = await sql`
      SELECT 
        o.id, o.total_amount, o.subtotal_amount, o.delivery_fee, o.order_type,
        o.scheduled_date, o.scheduled_time, o.delivery_address, o.special_instructions,
        o.latitude, o.longitude,
        u.name as customer_name, u.phone as customer_phone,
        b.name as branch_name, b.whatsapp_phone as branch_whatsapp, b.phone as branch_phone
      FROM orders o
      LEFT JOIN auth_users u ON o.user_id = u.id
      LEFT JOIN branches b ON o.branch_id = b.id
      WHERE o.id = ${Number(orderId)}
      LIMIT 1
    `;

    if (!order) {
      console.error(`[new_order_whatsapp] Order ${orderId} not found`);
      return { ok: false, error: "Order not found" };
    }

    const items = await sql`
      SELECT product_name, quantity, total_price, unit_price
      FROM order_items
      WHERE order_id = ${Number(orderId)}
    `;

    const itemsText = (items || [])
      .map(
        (i) =>
          `• ${i.quantity}x ${i.product_name} ($${Number(
            i.total_price || 0
          ).toFixed(2)})`
      )
      .join("\n");

    const rawBranchPhone =
      order.branch_whatsapp || order.branch_phone || "96181202607";
    const branchPhoneE164 = toLebanonE164(rawBranchPhone);

    const fullConfig = await getTemplateConfig("new_order_to_branch");
    if (!fullConfig) {
      console.warn(
        `[new_order_whatsapp] Template "new_order_to_branch" not configured in database`
      );
      return {
        ok: false,
        error: "Template new_order_to_branch not configured",
        hint: "Configure template in Admin Settings -> WhatsApp Templates -> new_order_to_branch",
      };
    }

    const rawPlaceholderCount = Number(
      fullConfig.template_config?.body_placeholder_count ||
        fullConfig.template_config?.bodyPlaceholderCount ||
        1
    );

    const bodyVariables = [];

    if (rawPlaceholderCount >= 1) {
      bodyVariables.push(String(orderNumber));
    }
    if (rawPlaceholderCount >= 2) {
      bodyVariables.push(order.branch_name || "Main Branch");
    }
    if (rawPlaceholderCount >= 3) {
      bodyVariables.push(itemsText || "No items listed");
    }
    if (rawPlaceholderCount >= 4) {
      bodyVariables.push(
        `$${Number(order.total_amount || 0).toFixed(2)}`
      );
    }
    if (rawPlaceholderCount >= 5) {
      bodyVariables.push(
        `${order.customer_name || "N/A"} (${order.customer_phone || "N/A"})`
      );
    }
    if (rawPlaceholderCount >= 6) {
      bodyVariables.push(
        order.delivery_address || "Pickup / Not specified"
      );
    }

    const payload = buildPayloadFromSchema(
      branchPhoneE164,
      fullConfig.template_name || "new_order_to_branch",
      fullConfig.template_config || {},
      bodyVariables,
      "en"
    );

    const res = await sendWhatsAppPayload(payload);
    console.log(
      `[new_order_whatsapp] API Response: status=${res.status}`,
      JSON.stringify(res.data)
    );

    const isOk = res.status >= 200 && res.status < 300;
    const hasGroupStatus = res.data?.messages?.[0]?.status?.groupName;
    const isSuccessGroup =
      hasGroupStatus === "PENDING" || hasGroupStatus === "DELIVERED";
    const statusName = res.data?.messages?.[0]?.status?.name;

    if (isOk && (isSuccessGroup || statusName === "PENDING_ENROUTE")) {
      return {
        ok: true,
        messageId: res.data?.messages?.[0]?.messageId,
        status: statusName,
      };
    } else {
      const errorMsg =
        res.data?.messages?.[0]?.status?.description ||
        res.data?.messages?.[0]?.status?.name ||
        JSON.stringify(res.data);
      console.error(
        `[new_order_whatsapp] WhatsApp send failed: ${errorMsg}`
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

    const [user] = await sql`
      SELECT name, first_name, last_name, phone 
      FROM auth_users 
      WHERE id = ${userId}
    `;

    if (!user) {
      return corsJson(
        request,
        { error: "User account not found" },
        { status: 404 },
      );
    }

    const clientName =
      user.name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ");

    const hasName = clientName && clientName.trim().length > 0;
    const hasPhone = user.phone && user.phone.trim().length > 0;

    if (!hasName || !hasPhone) {
      return corsJson(
        request,
        { error: "Please complete your profile registration (name and phone number are required) before placing an order." },
        { status: 400 },
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return corsJson(
        request,
        { error: "Cart is empty" },
        { status: 400 },
      );
    }

    const isPickup = order_type === "pickup";
    const isDelivery = order_type === "delivery";

    if (!isPickup && !isDelivery) {
      return corsJson(
        request,
        { error: "Invalid order type. Must be 'pickup' or 'delivery'." },
        { status: 400 },
      );
    }

    const effectiveBranchId = branch_id ? Number(branch_id) : 1;

    const deliveryFeeResult = await getDeliveryFee(order_type, {
      addressId: address_id,
      branchId: effectiveBranchId,
      address: delivery_address,
    });

    const deliveryFee = deliveryFeeResult.fee || 0;
    const distanceKm = deliveryFeeResult.distanceKm || 0;

    const itemsResult = await processOrderItems({
      request,
      items,
      effectiveBranchId,
    });

    if (!itemsResult.ok) {
      return itemsResult.response;
    }

    const { processedItems, subtotalAmount } = itemsResult;

    const creationResult = await createOrder({
      userId,
      effectiveBranchId,
      orderType: order_type,
      scheduledDate: scheduled_date,
      scheduledTime: scheduled_time,
      deliveryAddress: delivery_address,
      specialInstructions: special_instructions,
      subtotalAmount,
      deliveryFee,
      distanceKm,
      appliedRewardId: applied_reward_id || applied_user_reward_id,
    });

    if (!creationResult.ok) {
      return creationResult.response;
    }

    const { createdOrderId: newOrderId, createdOrderNumber } = creationResult;
    createdOrderId = newOrderId;

    await insertOrderItems({
      createdOrderId,
      processedItems,
    });

    await recordPromoRedemption({
      userId,
      promoCode: promo_code,
      createdOrderId,
      effectiveBranchId,
    });

    const inventoryResult = await deductInventory({
      processedItems,
      effectiveBranchId,
    });

    if (!inventoryResult.ok) {
      return inventoryResult.response;
    }

    await redeemPointsReward({
      userId,
      appliedRewardId: applied_reward_id || applied_user_reward_id,
      createdOrderId,
    });

    sendAutomatedOrderWhatsAppMessages({
      orderId: createdOrderId,
      orderNumber: createdOrderNumber,
      branchId: effectiveBranchId,
    }).catch((err) => {
      console.error("[automated_order_whatsapp] Async error:", err);
    });

    sendPushNotificationToBranchAdmins(effectiveBranchId, {
      title: "New Order Alert!",
      body: `New order #${createdOrderNumber} has been received.`,
      data: { orderId: String(createdOrderNumber), status: "pending" },
    }).catch((err) => {
      console.error("[new_order_push] Async error:", err);
    });

    return corsJson(request, {
      success: true,
      order_id: createdOrderId,
      order_number: createdOrderNumber,
      subtotal: subtotalAmount,
      delivery_fee: deliveryFee,
      total: subtotalAmount + deliveryFee,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return corsJson(
      request,
      { error: error?.message || "Failed to create order" },
      { status: 500 },
    );
  }
}
