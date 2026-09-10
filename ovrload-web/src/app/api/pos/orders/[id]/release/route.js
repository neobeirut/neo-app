import sql from "../../../../utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      claimed_terminal,
      force_release = false
    } = body;

    const [existing] = await sql`
      SELECT id, status, claimed_by, claimed_terminal, claimed_at, COALESCE(version, 1) as version
      FROM orders 
      WHERE id = ${id} 
      LIMIT 1
    `;

    if (!existing) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Only release if matching terminal, or force_release, or already null
    if (!force_release && claimed_terminal && existing.claimed_terminal && existing.claimed_terminal !== claimed_terminal) {
      return Response.json({
        error: "Cannot release lock held by another terminal without manager override",
        claimed_terminal: existing.claimed_terminal
      }, { status: 403 });
    }

    const updated = await sql`
      UPDATE orders
      SET 
        claimed_by = NULL,
        claimed_terminal = NULL,
        claimed_at = NULL,
        version = COALESCE(version, 1) + 1
      WHERE id = ${id}
      RETURNING id, status, version
    `;

    return Response.json({
      success: true,
      message: "Order lock released successfully",
      order: updated[0]
    });
  } catch (error) {
    console.error("Error in POST /api/pos/orders/[id]/release:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
