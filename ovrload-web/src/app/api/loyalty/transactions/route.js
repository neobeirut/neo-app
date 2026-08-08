import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent loyalty transactions with user info (admin view)
    const transactions = await sql`
      SELECT 
        lt.id,
        lt.transaction_type,
        lt.points,
        lt.description,
        lt.created_at,
        u.name as user_name,
        u.email as user_email
      FROM loyalty_transactions lt
      LEFT JOIN auth_users u ON lt.user_id = u.id
      ORDER BY lt.created_at DESC
      LIMIT 50
    `;

    return Response.json({
      transactions: transactions,
    });
  } catch (error) {
    console.error("Error fetching loyalty transactions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
