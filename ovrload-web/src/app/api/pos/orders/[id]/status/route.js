import sql from "../../../../utils/sql";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, voidReason } = body;

    if (!status) {
      return Response.json({ error: "Missing status field" }, { status: 400 });
    }

    if (voidReason) {
      await sql`
        UPDATE orders 
        SET status = ${status}, void_reason = ${voidReason}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE orders 
        SET status = ${status}
        WHERE id = ${id}
      `;
    }

    return Response.json({ success: true, orderId: id, status });
  } catch (error) {
    console.error("Error in PATCH /api/pos/orders/[id]/status:", error);
    return Response.json(
      { error: "Failed to update order status: " + error.message },
      { status: 500 }
    );
  }
}
