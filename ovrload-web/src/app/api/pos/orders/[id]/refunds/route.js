import sql from "../../../../utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const body = await request.json();

    const {
      operation_id,
      payment_id = null,
      refund_type = 'partial', // 'full' or 'partial'
      amount,
      amount_usd = null,
      amount_in_currency = null,
      exchange_rate_used = null,
      currency = 'USD',
      payment_method = 'Cash USD',
      reason = 'Refund requested',
      terminal_id = null,
      requested_by_reference = 'Cashier',
      approved_by_reference = 'Manager',
      external_reference = null,
      location_key = null
    } = body;

    if (!operation_id) {
      return Response.json({ error: "Missing operation_id UUID" }, { status: 400 });
    }

    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return Response.json({ error: "Invalid refund amount" }, { status: 400 });
    }

    // 1. Verify existing order
    const [existingOrder] = await sql`
      SELECT id, branch_id, total_amount, status, payment_method,
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

    const BRANCH_ID_TO_LOCATION = {
      1: 'cloud-kitchen',
      2: 'badaro',
      3: 'badaro-bistro',
      4: 'naccache-bistro'
    };
    const finalLocationKey = location_key || BRANCH_ID_TO_LOCATION[existingOrder.branch_id] || 'cloud-kitchen';
    const finalAmountUsd = amount_usd !== null && amount_usd !== undefined ? parseFloat(amount_usd) : refundAmount;
    const finalAmountInCurrency = amount_in_currency !== null && amount_in_currency !== undefined ? parseFloat(amount_in_currency) : refundAmount;
    const finalExchangeRate = exchange_rate_used !== null && exchange_rate_used !== undefined ? parseFloat(exchange_rate_used) : (currency === 'LBP' ? 89500 : null);

    // 2. Idempotency Check: if operation_id already exists in order_refunds
    const [existingRefund] = await sql`
      SELECT * FROM order_refunds WHERE operation_id = ${operation_id}::uuid LIMIT 1;
    `;
    if (existingRefund) {
      return Response.json({
        success: true,
        isDuplicate: true,
        refund: existingRefund,
        message: "Refund operation already processed"
      });
    }

    // 3. Validate refund amount <= available net paid
    const currentPaid = parseFloat(existingOrder.amount_paid || 0);
    const currentRefunded = parseFloat(existingOrder.amount_refunded || 0);
    const netPaid = Math.max(0, currentPaid - currentRefunded);

    if (refundAmount > netPaid) {
      return Response.json({ 
        error: `Refund amount ($${refundAmount.toFixed(2)}) exceeds available refundable balance ($${netPaid.toFixed(2)})`
      }, { status: 400 });
    }

    // 4. Insert refund record
    const [insertedRefund] = await sql`
      INSERT INTO order_refunds (
        operation_id,
        order_id,
        payment_id,
        location_key,
        refund_type,
        amount,
        amount_usd,
        amount_in_currency,
        exchange_rate_used,
        currency,
        payment_method,
        reason,
        terminal_id,
        requested_by_reference,
        approved_by_reference,
        external_reference,
        status,
        created_at,
        completed_at
      ) VALUES (
        ${operation_id}::uuid,
        ${orderId},
        ${payment_id !== null ? parseInt(payment_id, 10) : null},
        ${finalLocationKey},
        ${refund_type},
        ${refundAmount},
        ${finalAmountUsd},
        ${finalAmountInCurrency},
        ${finalExchangeRate},
        ${currency},
        ${payment_method},
        ${reason},
        ${terminal_id},
        ${requested_by_reference},
        ${approved_by_reference},
        ${external_reference},
        'completed',
        NOW(),
        NOW()
      )
      RETURNING *;
    `;

    // 5. Recalculate cumulative refunds
    const [refSum] = await sql`
      SELECT COALESCE(SUM(amount), 0)::float as total_refunded
      FROM order_refunds
      WHERE order_id = ${orderId} AND status = 'completed';
    `;
    const newTotalRefunded = parseFloat(refSum?.total_refunded || 0);

    let newPaymentStatus = existingOrder.payment_status;
    if (newTotalRefunded >= currentPaid && currentPaid > 0) {
      newPaymentStatus = 'REFUNDED';
    } else if (newTotalRefunded > 0) {
      newPaymentStatus = 'PARTIALLY_REFUNDED';
    }

    // 6. Update orders table summary
    // IMPORTANT: DO NOT CHANGE status TO 'cancelled'! Original order fulfillment status remains intact.
    await sql`
      UPDATE orders 
      SET 
        amount_refunded = ${newTotalRefunded},
        payment_status = ${newPaymentStatus},
        version = COALESCE(version, 1) + 1
      WHERE id = ${orderId};
    `;

    const remainingNetPaid = Math.max(0, currentPaid - newTotalRefunded);

    return Response.json({
      success: true,
      refund: insertedRefund,
      orderSummary: {
        orderId,
        totalAmount: parseFloat(existingOrder.total_amount || 0),
        amountPaid: currentPaid,
        amountRefunded: newTotalRefunded,
        netPaid: remainingNetPaid,
        paymentStatus: newPaymentStatus,
        fulfillmentStatus: existingOrder.status
      }
    });
  } catch (err) {
    console.error("Error in POST /api/pos/orders/[id]/refunds:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
