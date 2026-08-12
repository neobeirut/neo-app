import sql from "@/app/api/utils/sql";

// PATCH /api/orders/driver-status
// No user session required — used by the Driver PWA to mark orders as picked up
export async function PATCH(request) {
  try {
    const { orderId, status } = await request.json();

    if (!orderId) {
      return Response.json({ error: "orderId is required" }, { status: 400 });
    }

    const allowed = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];
    const newStatus = status || "completed";

    if (!allowed.includes(newStatus)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await sql`
      UPDATE orders
      SET status = ${newStatus}
      WHERE id = ${Number(orderId)}
      RETURNING id, status
    `;

    if (result.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    return Response.json({ success: true, order: result[0] });
  } catch (err) {
    console.error("[driver-status] Error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
