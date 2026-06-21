import sql from "@/app/api/utils/sql";
import { sendPushNotificationToBranchAdmins } from "@/app/api/utils/pushNotification";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.AUTH_SECRET || "f7ea89d42bb27ad8949826a798150aee";

  if (secret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Query all orders that are still pending
    const pendingOrders = await sql`
      SELECT id, branch_id
      FROM orders
      WHERE status = 'pending'
      ORDER BY id ASC
    `;

    if (pendingOrders.length === 0) {
      return Response.json({ message: "No pending orders", sent: 0 });
    }

    console.log(`[cron] Found ${pendingOrders.length} pending orders. Triggering push notifications...`);

    let notificationsSent = 0;
    const branchesNotified = new Set();

    for (const order of pendingOrders) {
      const branchId = order.branch_id;
      // Prevent spamming duplicate notifications for the same branch in the same cron run
      if (branchesNotified.has(branchId)) continue;

      branchesNotified.add(branchId);

      const res = await sendPushNotificationToBranchAdmins(branchId, {
        title: "Pending Order Reminder!",
        body: `Order #${order.id} is still waiting for response.`,
        data: { orderId: String(order.id), status: "pending" },
      });

      if (res.success) {
        notificationsSent += res.sentCount;
      }
    }

    return Response.json({
      message: "Pending orders processed",
      orders_checked: pendingOrders.length,
      notifications_sent: notificationsSent,
    });
  } catch (err) {
    console.error("[cron-pending-error]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
