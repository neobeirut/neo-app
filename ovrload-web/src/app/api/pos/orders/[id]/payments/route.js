import sql from "../../../../utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    const [order] = await sql`
      SELECT id, total_amount, status, payment_method, 
             COALESCE(payment_status, 'UNPAID') as payment_status,
             COALESCE(amount_paid, 0)::float as amount_paid,
             COALESCE(amount_refunded, 0)::float as amount_refunded,
             COALESCE(version, 1) as version,
             service_type, table_label, guest_count, waiter_reference,
             created_at
      FROM orders 
      WHERE id = ${orderId} 
      LIMIT 1;
    `;

    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const payments = await sql`
      SELECT id, operation_id, order_id, check_id, payment_method, payment_category, currency,
             exchange_rate_used::float as exchange_rate_used,
             amount_in_currency::float as amount_in_currency,
             amount_usd::float as amount_usd,
             tendered_amount::float as tendered_amount,
             change_amount::float as change_amount,
             terminal_id, cashier_reference, external_reference, status, created_at
      FROM order_payments
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC;
    `;

    const refunds = await sql`
      SELECT id, operation_id, order_id, payment_id, refund_type,
             amount::float as amount, currency, payment_method, reason,
             terminal_id, requested_by_reference, approved_by_reference,
             external_reference, status, created_at, completed_at
      FROM order_refunds
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC;
    `;

    const totalAmount = parseFloat(order.total_amount || 0);
    const amountPaid = parseFloat(order.amount_paid || 0);
    const amountRefunded = parseFloat(order.amount_refunded || 0);
    const netPaid = Math.max(0, amountPaid - amountRefunded);
    const amountRemaining = Math.max(0, totalAmount - amountPaid);

    return Response.json({
      success: true,
      orderSummary: {
        orderId,
        totalAmount,
        amountPaid,
        amountRefunded,
        netPaid,
        amountRemaining,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.status,
        version: order.version,
        serviceType: order.service_type,
        tableLabel: order.table_label,
        guestCount: order.guest_count,
        waiterReference: order.waiter_reference
      },
      payments: payments || [],
      refunds: refunds || []
    });
  } catch (err) {
    console.error("Error in GET /api/pos/orders/[id]/payments:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const body = await request.json();

    const {
      operation_id,
      check_id = null,
      payment_method = 'Cash USD',
      payment_category = 'direct',
      currency = 'USD',
      exchange_rate_used = null,
      amount_in_currency,
      amount_usd,
      tendered_amount = null,
      change_amount = null,
      terminal_id = null,
      cashier_reference = 'Cashier',
      external_reference = null
    } = body;

    if (!operation_id) {
      return Response.json({ error: "Missing operation_id UUID" }, { status: 400 });
    }

    // STRICT NO-FALLBACK: Cash LBP requires an explicit exchange rate
    if (currency === 'LBP') {
      const parsedRate = parseFloat(exchange_rate_used);
      if (isNaN(parsedRate) || parsedRate <= 0) {
        return Response.json({
          error: "LBP Payment Unavailable — Exchange Rate Not Configured. Every LBP tender must store the actual exchange_rate_used."
        }, { status: 400 });
      }
    }

    const appliedUsd = parseFloat(amount_usd);
    if (isNaN(appliedUsd) || appliedUsd <= 0) {
      return Response.json({ error: "Invalid payment amount_usd" }, { status: 400 });
    }

    // 1. Check existing order
    const [existingOrder] = await sql`
      SELECT id, total_amount, status, payment_method,
             COALESCE(payment_status, 'UNPAID') as payment_status,
             COALESCE(amount_paid, 0)::float as amount_paid,
             COALESCE(amount_refunded, 0)::float as amount_refunded,
             COALESCE(version, 1) as version
      FROM orders 
      WHERE id = ${orderId} 
      LIMIT 1;
    `;

    if (!existingOrder) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate check_id if provided
    let checkIdInt = null;
    if (check_id !== null && check_id !== undefined) {
      checkIdInt = parseInt(check_id, 10);
      const [chk] = await sql`
        SELECT id, total::float as total, amount_paid::float as amount_paid, status
        FROM order_checks
        WHERE id = ${checkIdInt} AND order_id = ${orderId}
        LIMIT 1;
      `;
      if (!chk) {
        return Response.json({ error: `Check #${check_id} does not belong to order #${orderId}` }, { status: 400 });
      }
    }

    // 2. Idempotency Check
    const [existingPayment] = await sql`
      SELECT * FROM order_payments WHERE operation_id = ${operation_id}::uuid LIMIT 1;
    `;
    if (existingPayment) {
      return Response.json({
        success: true,
        isDuplicate: true,
        payment: existingPayment,
        message: "Payment operation already processed"
      });
    }

    const BRANCH_ID_TO_LOCATION = {
      1: 'cloud-kitchen',
      2: 'badaro',
      3: 'badaro-bistro',
      4: 'naccache-bistro'
    };
    const finalLocationKey = body.location_key || BRANCH_ID_TO_LOCATION[existingOrder.branch_id] || 'cloud-kitchen';

    // 3. Insert into order_payments
    const [insertedPayment] = await sql`
      INSERT INTO order_payments (
        operation_id,
        order_id,
        check_id,
        location_key,
        payment_method,
        payment_category,
        currency,
        exchange_rate_used,
        amount_in_currency,
        amount_usd,
        tendered_amount,
        change_amount,
        terminal_id,
        cashier_reference,
        external_reference,
        status,
        created_at
      ) VALUES (
        ${operation_id}::uuid,
        ${orderId},
        ${checkIdInt},
        ${finalLocationKey},
        ${payment_method},
        ${payment_category},
        ${currency},
        ${exchange_rate_used !== null ? parseFloat(exchange_rate_used) : null},
        ${parseFloat(amount_in_currency || appliedUsd)},
        ${appliedUsd},
        ${tendered_amount !== null ? parseFloat(tendered_amount) : null},
        ${change_amount !== null ? parseFloat(change_amount) : null},
        ${terminal_id},
        ${cashier_reference},
        ${external_reference},
        'completed',
        NOW()
      )
      RETURNING *;
    `;

    // 4. Update check status & amount_paid if check_id is linked
    if (checkIdInt !== null) {
      const [checkPaySum] = await sql`
        SELECT COALESCE(SUM(amount_usd), 0)::float as paid
        FROM order_payments
        WHERE check_id = ${checkIdInt} AND status = 'completed';
      `;
      const checkPaid = parseFloat(checkPaySum?.paid || 0);
      const [targetCheck] = await sql`SELECT total::float as total FROM order_checks WHERE id = ${checkIdInt} LIMIT 1;`;
      const checkTot = parseFloat(targetCheck?.total || 0);
      const isCheckPaid = checkPaid >= checkTot;

      await sql`
        UPDATE order_checks
        SET amount_paid = ${checkPaid},
            status = ${isCheckPaid ? 'paid' : 'partially_paid'},
            closed_at = ${isCheckPaid ? sql`NOW()` : null}
        WHERE id = ${checkIdInt};
      `;
    }

    // 5. Recalculate cumulative payments across the entire order
    const [paySum] = await sql`
      SELECT COALESCE(SUM(amount_usd), 0)::float as total_paid
      FROM order_payments
      WHERE order_id = ${orderId} AND status = 'completed';
    `;
    const newTotalPaid = parseFloat(paySum?.total_paid || 0);
    const orderTotal = parseFloat(existingOrder.total_amount || 0);
    const currentRefunded = parseFloat(existingOrder.amount_refunded || 0);

    let newPaymentStatus = 'PARTIALLY_PAID';
    if (newTotalPaid >= orderTotal && orderTotal > 0) {
      newPaymentStatus = 'PAID';
    } else if (newTotalPaid <= 0) {
      newPaymentStatus = 'UNPAID';
    }

    // 6. Update orders table summary
    await sql`
      UPDATE orders 
      SET 
        amount_paid = ${newTotalPaid},
        payment_status = ${newPaymentStatus},
        payment_method = ${payment_method},
        payment_operation_id = ${operation_id}::uuid,
        version = COALESCE(version, 1) + 1
      WHERE id = ${orderId};
    `;

    const remaining = Math.max(0, orderTotal - newTotalPaid);
    const netPaid = Math.max(0, newTotalPaid - currentRefunded);

    return Response.json({
      success: true,
      payment: insertedPayment,
      orderSummary: {
        orderId,
        totalAmount: orderTotal,
        amountPaid: newTotalPaid,
        amountRefunded: currentRefunded,
        netPaid,
        amountRemaining: remaining,
        paymentStatus: newPaymentStatus
      }
    });
  } catch (err) {
    console.error("Error in POST /api/pos/orders/[id]/payments:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
