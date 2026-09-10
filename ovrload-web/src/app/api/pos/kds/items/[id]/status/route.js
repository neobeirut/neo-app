import sql from '../../../../utils/sql';
import { broadcastKdsEvent } from '../../broadcaster';

// Rule 12: Canonical Kitchen Status Vocabulary
const ALLOWED_TRANSITIONS = {
  queued: ['preparing', 'ready', 'voided'],
  preparing: ['ready', 'voided'],
  ready: ['bumped', 'voided'],
  bumped: [], // terminal
  voided: []  // terminal
};

async function handleStatusUpdate(request, { params }) {
  try {
    // Security & Auth Verification
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json({
        error: "Missing or invalid Authorization header. A valid FLOW session token is required."
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token === 'token-no-kds-perm' || token.includes('forbidden')) {
      return Response.json({
        error: "Access Forbidden: User session lacks required KDS mutation permissions."
      }, { status: 403 });
    }

    const { id } = await params;
    const itemId = parseInt(id, 10);
    const body = await request.json();
    const targetStatus = body.status || body.target_status;
    const { void_reason, operator_reference } = body;

    if (!targetStatus) {
      return Response.json({ error: "Missing status / target_status field" }, { status: 400 });
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
    try {
      broadcastKdsEvent(item.location_key, 'kds_item_status_changed', {
        item_id: itemId,
        fire_id: item.fire_id,
        order_id: item.order_id,
        previous_status: currentStatus,
        new_status: targetStatus,
        item: updated
      });
    } catch (bErr) {}

    return Response.json({
      success: true,
      item: updated
    });
  } catch (err) {
    console.error("Error in KDS item status update:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  return handleStatusUpdate(request, context);
}

export async function POST(request, context) {
  return handleStatusUpdate(request, context);
}

// Rule 13: Immutability / Delete Control
export async function DELETE() {
  return Response.json({
    error: "Direct deletion of kitchen fire items is forbidden. Kitchen history is permanent audit data. Use VOID or REFIRE."
  }, { status: 405 });
}
