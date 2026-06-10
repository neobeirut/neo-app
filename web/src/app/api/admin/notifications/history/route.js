import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const adminUser = await getAdminWithRolesFromRequest(request);
    if (!adminUser) {
      return corsJson(
        request,
        { error: "Unauthorized - Admin access required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get notification history
    const notifications = await sql`
      SELECT 
        apn.*,
        au.name as sent_by_name,
        au.email as sent_by_email,
        e.name as event_name
      FROM admin_push_notifications apn
      LEFT JOIN admin_users au ON apn.sent_by = au.id
      LEFT JOIN events e ON apn.event_id = e.id
      ORDER BY apn.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get total count
    const [{ count }] = await sql`
      SELECT COUNT(*) as count
      FROM admin_push_notifications
    `;

    return corsJson(request, {
      notifications,
      total: parseInt(count, 10),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return corsJson(
      request,
      { error: `Failed to fetch notification history: ${error.message}` },
      { status: 500 },
    );
  }
}
