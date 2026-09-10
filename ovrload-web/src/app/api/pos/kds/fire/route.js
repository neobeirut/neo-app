import sql from '../../../utils/sql';
import { broadcastKdsEvent } from '../broadcaster';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      operation_id,
      order_id,
      location_key = 'cloud-kitchen',
      service_type = 'dine_in',
      table_label_snapshot = null,
      guest_count_snapshot = null,
      waiter_reference_snapshot = null,
      fired_by_reference = 'Cashier',
      terminal_id = null,
      items = []
    } = body;

    if (!operation_id) {
      return Response.json({ error: "Missing operation_id UUID" }, { status: 400 });
    }

    if (!order_id) {
      return Response.json({ error: "Missing order_id" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Cannot create an empty kitchen fire" }, { status: 400 });
    }

    // Rule 5: Verify every item has a valid station_key (no silent drops)
    for (const it of items) {
      if (!it.station_key || !String(it.station_key).trim()) {
        return Response.json({
          error: `No kitchen station assigned for product "${it.product_name_snapshot || 'Item #' + it.order_item_id}". Send to Kitchen rejected.`
        }, { status: 400 });
      }
    }

    // 1. Fire Idempotency Check: return existing fire if operation_id already processed
    const [existingFire] = await sql`
      SELECT * FROM kitchen_fires WHERE operation_id = ${operation_id}::uuid LIMIT 1;
    `;
    if (existingFire) {
      const existingItems = await sql`
        SELECT * FROM kitchen_fire_items WHERE fire_id = ${existingFire.id} ORDER BY id ASC;
      `;
      return Response.json({
        success: true,
        isDuplicate: true,
        fire: existingFire,
        items: existingItems,
        message: "Fire operation already processed"
      });
    }

    // 2. Transactional Row Lock on Order + Fire Number Generation + Fired Quantity Invariant
    return await sql.transaction(async (txn) => {
      // Acquire row-level lock on the order
      const [order] = await txn`
        SELECT id, order_type, table_label, guest_count, waiter_reference, status
        FROM orders 
        WHERE id = ${order_id} 
        FOR UPDATE;
      `;

      if (!order) {
        throw new Error(`Order #${order_id} not found`);
      }

      // Compute sequential fire_number atomically for this order
      const [numRow] = await txn`
        SELECT COALESCE(MAX(fire_number), 0) + 1 AS next_fire_number
        FROM kitchen_fires
        WHERE order_id = ${order_id};
      `;
      const nextFireNumber = parseInt(numRow.next_fire_number, 10);

      // Rule 3: Fired Quantity Invariant
      // For each item: ever_fired_original_quantity = SUM(original fires, including voided, excluding refires)
      // Check: ever_fired_original_quantity + requested_quantity <= order_item.quantity
      for (const it of items) {
        const orderItemId = parseInt(it.order_item_id, 10);
        const reqQty = parseInt(it.quantity || 1, 10);

        const [itemRecord] = await txn`
          SELECT id, quantity 
          FROM order_items 
          WHERE id = ${orderItemId} AND order_id = ${order_id};
        `;

        if (!itemRecord) {
          throw new Error(`Order item #${orderItemId} does not belong to order #${order_id}`);
        }

        const [historyRow] = await txn`
          SELECT COALESCE(SUM(quantity), 0)::int AS ever_fired_qty
          FROM kitchen_fire_items
          WHERE order_item_id = ${orderItemId}
            AND refire_of_fire_item_id IS NULL; -- Exclude refires from original quantity ceiling
        `;
        const everFired = parseInt(historyRow.ever_fired_qty || 0, 10);
        const maxOrdered = parseInt(itemRecord.quantity, 10);

        if (everFired + reqQty > maxOrdered) {
          const remaining = Math.max(0, maxOrdered - everFired);
          throw new Error(
            `Quantity invariant violated for "${it.product_name_snapshot || 'Item #' + orderItemId}": already fired ${everFired} of ${maxOrdered} ordered units. Only ${remaining} unit(s) can be newly fired.`
          );
        }
      }

      // 3. Insert kitchen_fires record
      const [fire] = await txn`
        INSERT INTO kitchen_fires (
          operation_id,
          order_id,
          fire_number,
          location_key,
          service_type,
          table_label_snapshot,
          guest_count_snapshot,
          waiter_reference_snapshot,
          fired_by_reference,
          terminal_id,
          status,
          fired_at,
          created_at
        ) VALUES (
          ${operation_id}::uuid,
          ${order_id},
          ${nextFireNumber},
          ${location_key.toLowerCase()},
          ${service_type},
          ${table_label_snapshot || order.table_label},
          ${guest_count_snapshot || order.guest_count},
          ${waiter_reference_snapshot || order.waiter_reference},
          ${fired_by_reference},
          ${terminal_id},
          'active',
          NOW(),
          NOW()
        ) RETURNING *;
      `;

      // 4. Insert kitchen_fire_items with immutable snapshots
      const createdItems = [];
      for (const it of items) {
        const orderItemId = parseInt(it.order_item_id, 10);
        const reqQty = parseInt(it.quantity || 1, 10);
        const modSnapshot = typeof it.modifiers_snapshot === 'string'
          ? it.modifiers_snapshot
          : JSON.stringify(it.modifiers_snapshot || []);

        const [kfi] = await txn`
          INSERT INTO kitchen_fire_items (
            fire_id,
            order_item_id,
            quantity,
            station_key,
            status,
            product_name_snapshot,
            modifiers_snapshot,
            notes_snapshot,
            created_at
          ) VALUES (
            ${fire.id},
            ${orderItemId},
            ${reqQty},
            ${it.station_key.toUpperCase()},
            'queued',
            ${it.product_name_snapshot || 'Menu Item'},
            ${modSnapshot}::jsonb,
            ${it.notes_snapshot || null},
            NOW()
          ) RETURNING *;
        `;
        createdItems.push(kfi);
      }

      // Broadcast SSE notification to active kitchen stations for this location
      broadcastKdsEvent(location_key, 'fire_created', {
        fire: {
          ...fire,
          items: createdItems
        }
      });

      return Response.json({
        success: true,
        fire: {
          ...fire,
          items: createdItems
        },
        fireNumber: nextFireNumber,
        itemsCount: createdItems.length
      });
    });

  } catch (err) {
    console.error("Error in POST /api/pos/kds/fire:", err);
    return Response.json({ error: err.message }, { status: 400 });
  }
}
