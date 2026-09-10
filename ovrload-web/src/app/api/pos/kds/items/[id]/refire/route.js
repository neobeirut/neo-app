import sql from '../../../../utils/sql';
import { broadcastKdsEvent } from '../../broadcaster';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);
    const body = await request.json();
    const { refire_reason, quantity } = body;

    if (!refire_reason || !String(refire_reason).trim()) {
      return Response.json({ error: "A refire_reason is required to re-fire a kitchen item" }, { status: 400 });
    }

    const [original] = await sql`
      SELECT kfi.*, f.location_key, f.order_id
      FROM kitchen_fire_items kfi
      JOIN kitchen_fires f ON kfi.fire_id = f.id
      WHERE kfi.id = ${itemId}
      LIMIT 1;
    `;

    if (!original) {
      return Response.json({ error: "Original kitchen fire item not found" }, { status: 404 });
    }

    const refireQty = quantity ? parseInt(quantity, 10) : original.quantity;

    // Rule 3: REFIRE is a replacement production event and does NOT consume additional commerce quantity
    const [newItem] = await sql`
      INSERT INTO kitchen_fire_items (
        fire_id,
        order_item_id,
        quantity,
        station_key,
        status,
        product_name_snapshot,
        modifiers_snapshot,
        notes_snapshot,
        refire_of_fire_item_id,
        refire_reason,
        created_at
      ) VALUES (
        ${original.fire_id},
        ${original.order_item_id},
        ${refireQty},
        ${original.station_key},
        'queued',
        ${original.product_name_snapshot},
        ${JSON.stringify(original.modifiers_snapshot || [])}::jsonb,
        ${original.notes_snapshot},
        ${itemId},
        ${refire_reason.trim()},
        NOW()
      ) RETURNING *;
    `;

    // Ensure parent fire is active
    await sql`UPDATE kitchen_fires SET status = 'active' WHERE id = ${original.fire_id};`;

    broadcastKdsEvent(original.location_key, 'item_refired', {
      originalItemId: itemId,
      newItemId: newItem.id,
      fireId: original.fire_id,
      orderId: original.order_id,
      item: newItem
    });

    return Response.json({
      success: true,
      refireItem: newItem,
      message: "Replacement production item re-fired successfully without customer charge."
    });
  } catch (err) {
    console.error("Error in POST /api/pos/kds/items/[id]/refire:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
