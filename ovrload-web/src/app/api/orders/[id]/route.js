import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { resolveOrderId } from "../utils/orderIdResolver";

// Helper: load all known push tokens for a user (new table), falling back to legacy auth_users.push_token
// Push notification helpers removed. Managed centrally via whatsappNotification.js

export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = params;
    const { status } = await request.json();

    const resolvedId = await resolveOrderId(id);
    if (!resolvedId) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "out_for_delivery",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    await sql`
      UPDATE orders 
      SET status = ${status}
      WHERE id = ${resolvedId}
    `;

    let pushDebug = {
      attempted: false,
      skipped: true,
      reason: "Handled by customer notification service"
    };

    return Response.json({
      message: "Order status updated successfully",
      status,
      push: pushDebug,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return Response.json(
      { error: "Failed to update order status", details: error.message },
      { status: 500 },
    );
  }
}

// Delete order
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = params;

    const resolvedId = await resolveOrderId(id);
    if (!resolvedId) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Delete order and its related items/addons atomically
    await sql.transaction([
      sql`DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ${resolvedId})`,
      sql`DELETE FROM order_items WHERE order_id = ${resolvedId}`,
      sql`DELETE FROM orders WHERE id = ${resolvedId}`,
    ]);

    return Response.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    return Response.json(
      { error: "Failed to delete order", details: error.message },
      { status: 500 },
    );
  }
}
