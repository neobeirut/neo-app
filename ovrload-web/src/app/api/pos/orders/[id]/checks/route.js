import sql from "../../../../utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    const checks = await sql`
      SELECT id, order_id, check_number, label, status,
             subtotal::float as subtotal,
             discount::float as discount,
             total::float as total,
             amount_paid::float as amount_paid,
             split_operation_id, created_at, closed_at
      FROM order_checks
      WHERE order_id = ${orderId}
      ORDER BY check_number ASC;
    `;

    const allocations = await sql`
      SELECT ca.id, ca.check_id, ca.order_item_id, ca.quantity,
             ca.allocated_amount::float as allocated_amount,
             oi.product_id, p.name as product_name, oi.unit_price::float as unit_price,
             oi.customizations
      FROM order_check_allocations ca
      JOIN order_checks c ON ca.check_id = c.id
      JOIN order_items oi ON ca.order_item_id = oi.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE c.order_id = ${orderId};
    `;

    // Group allocations by check_id
    const allocsByCheck = {};
    for (const a of allocations) {
      if (!allocsByCheck[a.check_id]) allocsByCheck[a.check_id] = [];
      allocsByCheck[a.check_id].push(a);
    }

    const checksWithItems = checks.map(c => ({
      ...c,
      items: allocsByCheck[c.id] || []
    }));

    return Response.json({
      success: true,
      orderId,
      checks: checksWithItems
    });
  } catch (err) {
    console.error("Error in GET /api/pos/orders/[id]/checks:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const body = await request.json();

    const {
      split_operation_id,
      split_type, // 'equal' or 'item'
      ways = 2,
      checks = []
    } = body;

    if (!split_operation_id) {
      return Response.json({ error: "Missing split_operation_id UUID" }, { status: 400 });
    }

    // 1. Idempotency Check: if checks with this split_operation_id already exist, return them
    const existingOpChecks = await sql`
      SELECT id, order_id, check_number, label, status,
             subtotal::float as subtotal, total::float as total, amount_paid::float as amount_paid
      FROM order_checks
      WHERE split_operation_id = ${split_operation_id}::uuid
      ORDER BY check_number ASC;
    `;
    if (existingOpChecks.length > 0) {
      return Response.json({
        success: true,
        isDuplicate: true,
        checks: existingOpChecks,
        message: "Split operation already processed"
      });
    }

    // 2. Load order and items
    const [order] = await sql`
      SELECT id, total_amount::float as total_amount, subtotal_amount::float as subtotal_amount,
             status, payment_status, amount_paid::float as amount_paid
      FROM orders
      WHERE id = ${orderId}
      LIMIT 1;
    `;
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if order already has paid checks
    const existingPaidChecks = await sql`
      SELECT id FROM order_checks WHERE order_id = ${orderId} AND (status = 'paid' OR amount_paid > 0) LIMIT 1;
    `;
    if (existingPaidChecks.length > 0) {
      return Response.json({
        error: "Cannot recreate whole split: one or more checks have already received payment."
      }, { status: 400 });
    }

    // 3. Clear any existing UNPAID checks for this order before applying new split
    await sql`DELETE FROM order_checks WHERE order_id = ${orderId};`;

    const orderTotal = parseFloat(order.total_amount || 0);

    // 4. EQUAL SPLIT ENGINE
    if (split_type === 'equal') {
      const numWays = parseInt(ways, 10);
      if (isNaN(numWays) || numWays < 2 || numWays > 20) {
        return Response.json({ error: "Invalid split ways (must be between 2 and 20)" }, { status: 400 });
      }

      // Convert to integer cents to guarantee 100% rounding invariant
      const totalCents = Math.round(orderTotal * 100);
      const baseCents = Math.floor(totalCents / numWays);
      const remainderCents = totalCents % numWays;

      const createdChecks = [];
      for (let i = 0; i < numWays; i++) {
        // Remainder cents distributed 1 by 1 to first remainderCents checks
        const checkCents = baseCents + (i < remainderCents ? 1 : 0);
        const checkAmount = parseFloat((checkCents / 100).toFixed(2));
        const checkNum = i + 1;
        const checkLabel = `Split ${checkNum}/${numWays}`;

        const [c] = await sql`
          INSERT INTO order_checks (
            order_id, check_number, label, status, subtotal, total, amount_paid, split_operation_id
          ) VALUES (
            ${orderId}, ${checkNum}, ${checkLabel}, 'open', ${checkAmount}, ${checkAmount}, 0, ${split_operation_id}::uuid
          ) RETURNING *;
        `;
        createdChecks.push({
          ...c,
          subtotal: parseFloat(c.subtotal),
          total: parseFloat(c.total),
          amount_paid: 0
        });
      }

      return Response.json({
        success: true,
        split_type: 'equal',
        totalSplit: orderTotal,
        checks: createdChecks
      });
    }

    // 5. ITEM-BY-ITEM SPLIT ENGINE
    if (split_type === 'item') {
      if (!Array.isArray(checks) || checks.length < 2) {
        return Response.json({ error: "Item split requires at least 2 checks" }, { status: 400 });
      }

      // Load original order items
      const orderItems = await sql`
        SELECT id, quantity, unit_price::float as unit_price, total_price::float as total_price
        FROM order_items
        WHERE order_id = ${orderId};
      `;
      const itemMap = new Map();
      for (const item of orderItems) {
        itemMap.set(item.id, {
          totalQty: item.quantity,
          unitPrice: item.unit_price,
          allocatedQty: 0,
          allocatedAmount: 0
        });
      }

      // Validate allocations across all submitted checks
      let totalAllocatedMoney = 0;
      for (const chk of checks) {
        if (!Array.isArray(chk.items) || chk.items.length === 0) continue;
        for (const alloc of chk.items) {
          const itemRecord = itemMap.get(alloc.order_item_id);
          if (!itemRecord) {
            return Response.json({
              error: `Item #${alloc.order_item_id} does not belong to order #${orderId}`
            }, { status: 400 });
          }

          const qty = parseInt(alloc.quantity, 10);
          if (isNaN(qty) || qty <= 0) {
            return Response.json({ error: "Allocated quantity must be positive" }, { status: 400 });
          }

          itemRecord.allocatedQty += qty;
          if (itemRecord.allocatedQty > itemRecord.totalQty) {
            return Response.json({
              error: `Item #${alloc.order_item_id} allocated quantity (${itemRecord.allocatedQty}) exceeds ordered quantity (${itemRecord.totalQty})`
            }, { status: 400 });
          }

          const allocAmt = parseFloat((alloc.allocated_amount !== undefined ? alloc.allocated_amount : (qty * itemRecord.unitPrice)).toFixed(2));
          if (isNaN(allocAmt) || allocAmt <= 0) {
            return Response.json({ error: "Allocated amount must be positive" }, { status: 400 });
          }
          itemRecord.allocatedAmount += allocAmt;
          totalAllocatedMoney += allocAmt;
        }
      }

      // Execute transactional insertion
      const createdChecks = [];
      let checkNumber = 1;

      for (const chk of checks) {
        const checkItems = chk.items || [];
        const checkSubtotal = checkItems.reduce((sum, it) => {
          const itRec = itemMap.get(it.order_item_id);
          const amt = it.allocated_amount !== undefined ? parseFloat(it.allocated_amount) : (parseInt(it.quantity, 10) * itRec.unitPrice);
          return sum + amt;
        }, 0);
        const checkTotal = parseFloat(checkSubtotal.toFixed(2));
        const checkLabel = chk.label || `Check ${checkNumber}`;

        const [c] = await sql`
          INSERT INTO order_checks (
            order_id, check_number, label, status, subtotal, total, amount_paid, split_operation_id
          ) VALUES (
            ${orderId}, ${checkNumber}, ${checkLabel}, 'open', ${checkTotal}, ${checkTotal}, 0, ${split_operation_id}::uuid
          ) RETURNING *;
        `;

        for (const it of checkItems) {
          const itRec = itemMap.get(it.order_item_id);
          const amt = it.allocated_amount !== undefined ? parseFloat(it.allocated_amount) : (parseInt(it.quantity, 10) * itRec.unitPrice);
          await sql`
            INSERT INTO order_check_allocations (
              check_id, order_item_id, quantity, allocated_amount
            ) VALUES (
              ${c.id}, ${it.order_item_id}, ${parseInt(it.quantity, 10)}, ${parseFloat(amt.toFixed(2))}
            );
          `;
        }

        createdChecks.push({
          ...c,
          subtotal: checkTotal,
          total: checkTotal,
          amount_paid: 0,
          itemsCount: checkItems.length
        });
        checkNumber++;
      }

      return Response.json({
        success: true,
        split_type: 'item',
        totalAllocated: totalAllocatedMoney,
        checks: createdChecks
      });
    }

    return Response.json({ error: "Invalid split_type (must be 'equal' or 'item')" }, { status: 400 });
  } catch (err) {
    console.error("Error in POST /api/pos/orders/[id]/checks:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    const paidChecks = await sql`
      SELECT id FROM order_checks WHERE order_id = ${orderId} AND (status = 'paid' OR amount_paid > 0) LIMIT 1;
    `;
    if (paidChecks.length > 0) {
      return Response.json({ error: "Cannot delete split: one or more checks have already been paid" }, { status: 400 });
    }

    await sql`DELETE FROM order_checks WHERE order_id = ${orderId};`;

    return Response.json({
      success: true,
      message: "Split checks deleted successfully"
    });
  } catch (err) {
    console.error("Error in DELETE /api/pos/orders/[id]/checks:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
