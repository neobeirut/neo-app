import sql from "../../../../utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      claimed_by = "Cashier",
      claimed_terminal = "UNKNOWN-TERMINAL",
      force_override = false
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

    // Check if order is already claimed by another active terminal (< 15 min lock)
    if (!force_override) {
      const isClaimActive = existing.claimed_terminal &&
        existing.claimed_terminal !== claimed_terminal &&
        existing.claimed_at &&
        (new Date().getTime() - new Date(existing.claimed_at).getTime()) < 15 * 60 * 1000;

      if (isClaimActive) {
        return Response.json({
          conflict: true,
          error: `Order is currently being handled by ${existing.claimed_by || "another cashier"} on ${existing.claimed_terminal}.`,
          claimed_by: existing.claimed_by,
          claimed_terminal: existing.claimed_terminal,
          claimed_at: existing.claimed_at,
          can_override: true
        }, { status: 409 });
      }
    }

    // Atomic claim execution
    const updated = await sql`
      UPDATE orders
      SET 
        claimed_by = ${claimed_by},
        claimed_terminal = ${claimed_terminal},
        claimed_at = NOW(),
        version = COALESCE(version, 1) + 1
      WHERE id = ${id}
      RETURNING id, customer_name, status, version, claimed_by, claimed_terminal, claimed_at
    `;

    if (!updated || updated.length === 0) {
      return Response.json({
        conflict: true,
        error: "Failed to claim order due to concurrent modification. Please refresh.",
        can_override: true
      }, { status: 409 });
    }

    return Response.json({
      success: true,
      message: "Order claimed successfully",
      order: updated[0]
    });
  } catch (error) {
    console.error("Error in POST /api/pos/orders/[id]/claim:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
