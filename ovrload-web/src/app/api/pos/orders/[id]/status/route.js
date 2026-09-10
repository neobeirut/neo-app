import sql from "../../../../utils/sql";
import crypto from "crypto";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      expected_version,
      payment_operation_id,
      void_operation_id,
      is_manager_override,
      voidReason,
      subtotal,
      deliveryFee,
      discountAmount,
      total,
      customerName,
      customerPhone,
      deliveryAddress,
      orderType,
      orderSource,
      items
    } = body;

    if (!status) {
      return Response.json({ error: "Missing status field" }, { status: 400 });
    }

    const [existingOrder] = await sql`
      SELECT 
        id, 
        status, 
        customer_phone, 
        COALESCE(version, 1) as version, 
        client_order_token, 
        claimed_by, 
        claimed_terminal, 
        claimed_at,
        payment_operation_id,
        void_operation_id
      FROM orders 
      WHERE id = ${id} 
      LIMIT 1
    `;
    if (!existingOrder) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // 1. PAYMENT IDEMPOTENCY CHECK
    if (payment_operation_id) {
      if (existingOrder.payment_operation_id === payment_operation_id) {
        return Response.json({
          success: true,
          orderId: id,
          status: existingOrder.status,
          version: existingOrder.version,
          isDuplicate: true,
          message: "Idempotent response: payment operation already finalized"
        });
      }
      if ((existingOrder.status === "completed" || existingOrder.status === "delivered") && existingOrder.payment_operation_id) {
        return Response.json({
          conflict: true,
          error: "Order has already been paid and completed under another transaction.",
          currentOrder: existingOrder
        }, { status: 409 });
      }
    }

    // 2. VOID / CANCEL IDEMPOTENCY CHECK
    if (void_operation_id) {
      if (existingOrder.void_operation_id === void_operation_id) {
        return Response.json({
          success: true,
          orderId: id,
          status: existingOrder.status,
          version: existingOrder.version,
          isDuplicate: true,
          message: "Idempotent response: void operation already processed"
        });
      }
      if (existingOrder.status === "cancelled" && existingOrder.void_operation_id) {
        return Response.json({
          conflict: true,
          error: "Order has already been cancelled under another void transaction.",
          currentOrder: existingOrder
        }, { status: 409 });
      }
    }

    // 3. OPTIMISTIC CONCURRENCY CHECK
    const expectedVersion = (expected_version !== undefined && expected_version !== null)
      ? parseInt(expected_version, 10)
      : null;

    if (expectedVersion !== null && !isNaN(expectedVersion) && existingOrder.version !== expectedVersion) {
      const [currentOrder] = await sql`
        SELECT o.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'order_id', oi.order_id,
                'product_id', oi.product_id,
                'product_name', p.name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'customizations', oi.customizations,
                'comment', oi.comment
              )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]'
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = ${id}
        GROUP BY o.id
      `;
      return Response.json({
        conflict: true,
        error: "This order was updated on another terminal. The latest version has been loaded.",
        currentOrder: currentOrder || existingOrder
      }, { status: 409 });
    }

    // 4. STATUS TRANSITIONS & TERMINAL STATES GUARD
    const prevStatus = existingOrder.status;
    const ALLOWED_TRANSITIONS = {
      pending: ["confirmed", "accepted", "preparing", "cancelled"],
      accepted: ["preparing", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      held: ["pending", "confirmed", "preparing", "cancelled"],
      preparing: ["ready", "out_for_delivery", "completed", "delivered", "cancelled"],
      ready: ["out_for_delivery", "completed", "delivered", "cancelled"],
      out_for_delivery: ["completed", "delivered", "cancelled"],
      completed: [],
      delivered: [],
      cancelled: []
    };

    if (status !== prevStatus) {
      const isTerminal = prevStatus === "completed" || prevStatus === "delivered" || prevStatus === "cancelled";
      if (isTerminal) {
        const isAuthorizedManagerVoid = (status === "cancelled" && (voidReason || void_operation_id || is_manager_override));
        if (!isAuthorizedManagerVoid) {
          return Response.json({
            conflict: true,
            error: `Cannot change status of order in terminal state '${prevStatus}' without authorized manager void.`,
            currentStatus: prevStatus
          }, { status: 409 });
        }
      } else {
        const validTargets = ALLOWED_TRANSITIONS[prevStatus];
        if (validTargets && !validTargets.includes(status) && !is_manager_override) {
          return Response.json({
            conflict: true,
            error: `Invalid status transition from '${prevStatus}' to '${status}'.`,
            currentStatus: prevStatus
          }, { status: 409 });
        }
      }
    }

    const phoneToNotify = customerPhone || existingOrder.customer_phone;

    let updateResult;

    if (voidReason) {
      updateResult = await sql`
        UPDATE orders 
        SET 
          status = ${status}, 
          void_reason = ${voidReason},
          void_operation_id = COALESCE(${void_operation_id || null}, void_operation_id),
          claimed_by = NULL,
          claimed_terminal = NULL,
          claimed_at = NULL,
          version = COALESCE(version, 1) + 1
        WHERE id = ${id} ${expectedVersion !== null && !isNaN(expectedVersion) ? sql`AND version = ${expectedVersion}` : sql``}
        RETURNING id, status, version
      `;
    } else {
      if (customerName !== undefined && (!customerName || !String(customerName).trim())) {
        return Response.json({ error: "Customer name is required to save the order" }, { status: 400 });
      }
      updateResult = await sql`
        UPDATE orders 
        SET 
          status = ${status},
          version = COALESCE(version, 1) + 1,
          claimed_by = NULL,
          claimed_terminal = NULL,
          claimed_at = NULL,
          payment_operation_id = COALESCE(${payment_operation_id || null}, payment_operation_id),
          subtotal_amount = COALESCE(${subtotal !== undefined && subtotal !== null ? subtotal : null}, subtotal_amount),
          delivery_fee = COALESCE(${deliveryFee !== undefined && deliveryFee !== null ? deliveryFee : null}, delivery_fee),
          discount_amount = COALESCE(${discountAmount !== undefined && discountAmount !== null ? discountAmount : null}, discount_amount),
          total_amount = COALESCE(${total !== undefined && total !== null ? total : null}, total_amount),
          customer_name = COALESCE(${customerName || null}, customer_name),
          customer_phone = COALESCE(${customerPhone || null}, customer_phone),
          delivery_address = COALESCE(${deliveryAddress || null}, delivery_address),
          order_type = COALESCE(${orderType || null}, order_type),
          order_source = COALESCE(${orderSource || null}, order_source)
        WHERE id = ${id} ${expectedVersion !== null && !isNaN(expectedVersion) ? sql`AND version = ${expectedVersion}` : sql``}
        RETURNING id, status, version
      `;
    }

    if (!updateResult || updateResult.length === 0) {
      const [currentOrder] = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      return Response.json({
        conflict: true,
        error: "This order was updated on another terminal. The latest version has been loaded.",
        currentOrder: currentOrder || existingOrder
      }, { status: 409 });
    }

    // Auto-record legacy payment in order_payments if order is completed/delivered without existing payments
    if (status === 'completed' || status === 'delivered') {
      try {
        const existingPayments = await sql`SELECT id FROM order_payments WHERE order_id = ${id} LIMIT 1`;
        if (existingPayments.length === 0) {
          const legacyOpId = crypto.randomUUID();
          const orderTotal = parseFloat(total !== undefined && total !== null ? total : (existingOrder.total_amount || 0));
          const method = existingOrder.payment_method || 'Cash USD';
          const isAggregator = ['toters', 'noknok'].includes(method.toLowerCase());

          await sql`
            INSERT INTO order_payments (
              operation_id, order_id, payment_method, payment_category,
              currency, amount_in_currency, amount_usd,
              terminal_id, cashier_reference, external_reference, status, created_at
            ) VALUES (
              ${legacyOpId}::uuid, ${id}, ${method}, ${isAggregator ? 'aggregator' : 'direct'},
              'USD', ${orderTotal}, ${orderTotal},
              'legacy-pos', 'Legacy POS', 'Auto-recorded on status completion', 'completed', NOW()
            ) ON CONFLICT (operation_id) DO NOTHING;
          `;

          await sql`
            UPDATE orders
            SET payment_status = 'PAID',
                amount_paid = ${orderTotal}
            WHERE id = ${id} AND (payment_status IS NULL OR payment_status = 'UNPAID');
          `;
        }
      } catch (payErr) {
        console.error("Error auto-recording legacy payment on status completion:", payErr);
      }
    }

      // Update order items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        await sql`DELETE FROM order_items WHERE order_id = ${id}`;
        for (const item of items) {
          const unitPrice = parseFloat(item.unit_price || item.unit_price_usd || 0);
          const qty = parseInt(item.quantity || item.qty || 1, 10);
          const totalPrice = unitPrice * qty;
          const custText = Array.isArray(item.customizations)
            ? item.customizations.map(c => typeof c === "string" ? c : (c.ingredient || c.name)).join(", ")
            : (item.customizations || null);
          const commentText = item.comment || item.note || null;

          await sql`
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              unit_price,
              total_price,
              customizations,
              comment
            ) VALUES (
              ${id},
              ${item.product_id || item.id},
              ${qty},
              ${unitPrice},
              ${totalPrice},
              ${custText},
              ${commentText}
            )
          `;
        }
      }

      // Send "We are preparing your items now!" when accepted/preparing/confirmed from POS (only once on transition)
      const isPreparingOrAccepted = status === "preparing" || status === "confirmed" || status === "accepted";
      const wasPreparingOrAccepted = prevStatus === "preparing" || prevStatus === "confirmed" || prevStatus === "accepted";

      if (isPreparingOrAccepted && !wasPreparingOrAccepted && phoneToNotify) {
        try {
          const normPhone = String(phoneToNotify).replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "961");
          const target = normPhone.length === 8 ? "961" + normPhone : normPhone;
          const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
          const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
          const sender = "96181202607";

          console.log(`[pos-status] Sending order_preparing template to ${target} for order #${id}`);
          const prepRes = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
            method: "POST",
            headers: {
              "Authorization": `App ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              messages: [{
                from: sender,
                to: target,
                content: {
                  templateName: "order_preparing",
                  templateData: { body: { placeholders: [] } },
                  language: "en"
                }
              }]
            })
          });
          const prepData = await prepRes.json().catch(() => ({}));
          console.log(`[pos-status] order_preparing response status: ${prepRes.status}`, JSON.stringify(prepData));
        } catch (e) {
          console.error("Failed to send order_preparing notification from POS:", e);
        }
      }

      // Send "out_for_delivery" when marked as out_for_delivery, completed, or delivered from POS
      const isPickupOrDelivery = status === "out_for_delivery" || status === "completed" || status === "delivered";
      const wasPickupOrDelivery = prevStatus === "out_for_delivery" || prevStatus === "completed" || prevStatus === "delivered";

      if (isPickupOrDelivery && !wasPickupOrDelivery && phoneToNotify) {
        try {
          const normPhone = String(phoneToNotify).replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "961");
          const target = normPhone.length === 8 ? "961" + normPhone : normPhone;
          const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
          const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
          const sender = "96181202607";
          const orderTag = `#${id}`;

          console.log(`[pos-status] Sending out_for_delivery template to ${target} for order ${orderTag}`);
          const outRes = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
            method: "POST",
            headers: {
              "Authorization": `App ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              messages: [{
                from: sender,
                to: target,
                content: {
                  templateName: "out_for_delivery",
                  templateData: { body: { placeholders: [orderTag] } },
                  language: "en"
                }
              }]
            })
          });
          const outData = await outRes.json().catch(() => ({}));
          console.log(`[pos-status] out_for_delivery response status: ${outRes.status}`, JSON.stringify(outData));
        } catch (e) {
          console.error("Failed to send out_for_delivery notification from POS:", e);
        }
      }
    }

    // Send "rejected_order" when cancelled/rejected from POS
    if (status === "cancelled" && prevStatus !== "cancelled" && phoneToNotify) {
      try {
        const normPhone = String(phoneToNotify).replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "961");
        const target = normPhone.length === 8 ? "961" + normPhone : normPhone;
        const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
        const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
        const sender = "96181202607";

          console.log(`[pos-status] Sending rejected_order template to ${target} for order #${id}`);
          const res = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
            method: "POST",
            headers: {
              "Authorization": `App ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              messages: [{
                from: sender,
                to: target,
                content: {
                  templateName: "rejected_order",
                  templateData: { body: { placeholders: [String(id)] } },
                  language: "en"
                }
              }]
            })
          });
          const resData = await res.json().catch(() => ({}));
          console.log(`[pos-status] rejected_order response status: ${res.status}`, JSON.stringify(resData));
      } catch (e) {
        console.error("Failed to send rejected_order notification from POS:", e);
      }
    }

    return Response.json({
      success: true,
      orderId: id,
      status,
      version: updateResult?.[0]?.version || (existingOrder.version + 1)
    });
  } catch (error) {
    console.error("Error in PATCH /api/pos/orders/[id]/status:", error);
    return Response.json(
      { error: "Failed to update order status: " + error.message },
      { status: 500 }
    );
  }
}

