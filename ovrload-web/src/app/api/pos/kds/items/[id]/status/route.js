import sql from '../../../../utils/sql';
import { broadcastKdsEvent } from '../../broadcaster';

// Rule 13: Explicit Allowed State Machine Transitions
const ALLOWED_TRANSITIONS = {
  queued: ['preparing', 'ready', 'voided'],
  preparing: ['ready', 'voided'],
  ready: ['bumped', 'voided'],
  bumped: [], // terminal
  voided: []  // terminal
};

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);
    const body = await request.json();
    const { status: targetStatus, void_reason, authorized_by } = body;

    if (!targetStatus) {
      return Response.json({ error: "Missing status field" }, { status: 400 });
    }

    const [item] = await sql`
      SELECT kfi.*, f.location_key, f.order_id
      FROM kitchen_fire_items kfi
      JOIN kitchen_fires f ON kfi.fire_id = f.id
      WHERE kfi.id = ${itemId}
      LIMIT 1;
    `;

    if (!item) {
      return Response.json({ error: "Kitchen fire item not found" }, { status: 404 });
    }

    const currentStatus = item.status;
    const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!validNextStates.includes(targetStatus)) {
      return Response.json({
        error: `Invalid KDS status transition from "${currentStatus}" to "${targetStatus}". Allowed next states: ${validNextStates.join(', ') || 'None (Terminal state)'}`
      }, { status: 400 });
    }

    if (targetStatus === 'voided' && !void_reason) {
      return Response.json({ error: "Voiding a fired kitchen item requires an explicit void_reason" }, { status: 400 });
    }

    let startedAt = item.started_at;
    let readyAt = item.ready_at;
    let bumpedAt = item.bumped_at;
    let voidedAt = item.voided_at;

    if (targetStatus === 'preparing' && !startedAt) startedAt = new Date().toISOString();
    if (targetStatus === 'ready' && !readyAt) {
      if (!startedAt) startedAt = new Date().toISOString();
      readyAt = new Date().toISOString();
    }
    if (targetStatus === 'bumped') bumpedAt = new Date().toISOString();
    if (targetStatus === 'voided') voidedAt = new Date().toISOString();

    const [updated] = await sql`
      UPDATE kitchen_fire_items
      SET 
        status = ${targetStatus},
        started_at = COALESCE(started_at, ${startedAt}),
        ready_at = COALESCE(ready_at, ${readyAt}),
        bumped_at = COALESCE(bumped_at, ${bumpedAt}),
        voided_at = COALESCE(voided_at, ${voidedAt})
      WHERE id = ${itemId}
      RETURNING *;
    `;

    // Check if entire fire is bumped
    const remainingInFire = await sql`
      SELECT id FROM kitchen_fire_items
      WHERE fire_id = ${item.fire_id} AND status NOT IN ('bumped', 'voided')
      LIMIT 1;
    `;
    if (remainingInFire.length === 0) {
      await sql`UPDATE kitchen_fires SET status = 'completed' WHERE id = ${item.fire_id};`;
    }

    // Broadcast SSE update
    broadcastKdsEvent(item.location_key, 'item_status_changed', {
      itemId,
      fireId: item.fire_id,
      orderId: item.order_id,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      item: updated
    });

    return Response.json({
      success: true,
      item: updated
    });
  } catch (err) {
    console.error("Error in PATCH /api/pos/kds/items/[id]/status:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
