import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    // Get all users with their loyalty info, role, and order count
    const users = await sql`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone,
        u.first_name,
        u.last_name,
        u.points, 
        u.membership_tier, 
        u.total_spent,
        u."emailVerified",
        u.role,
        u.branch_id,
        b.name as branch_name,
        COALESCE(order_counts.order_count, 0) as order_count
      FROM auth_users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as order_count
        FROM orders
        GROUP BY user_id
      ) order_counts ON u.id = order_counts.user_id
      ORDER BY u.total_spent DESC, u.points DESC
    `;

    return Response.json({
      users: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
    const currentUser = await sql`
      SELECT role FROM auth_users WHERE id = ${session.user.id}
    `;

    if (
      !currentUser ||
      currentUser.length === 0 ||
      currentUser[0].role !== "admin"
    ) {
      return Response.json(
        { error: "Only admins can update user roles" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { user_id, role, branch_id } = body;

    if (!user_id || !role) {
      return Response.json(
        { error: "user_id and role are required" },
        { status: 400 },
      );
    }

    // Validate role
    const validRoles = ["customer", "branch_admin", "admin"];
    if (!validRoles.includes(role)) {
      return Response.json(
        { error: "Invalid role. Must be customer, branch_admin, or admin" },
        { status: 400 },
      );
    }

    // If role is branch_admin, branch_id is required
    if (role === "branch_admin" && !branch_id) {
      return Response.json(
        { error: "branch_id is required for branch_admin role" },
        { status: 400 },
      );
    }

    // Update user role and branch_id
    if (role === "branch_admin") {
      await sql`
        UPDATE auth_users 
        SET role = ${role}, branch_id = ${branch_id}
        WHERE id = ${user_id}
      `;
    } else {
      // Clear branch_id for non-branch_admin roles
      await sql`
        UPDATE auth_users 
        SET role = ${role}, branch_id = NULL
        WHERE id = ${user_id}
      `;
    }

    return Response.json({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
