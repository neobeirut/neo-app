import sql from "@/app/api/utils/sql";
import { hash } from "argon2";

// This endpoint creates the initial admin user
export async function POST(request) {
  try {
    // Check if admin user already exists
    const existing = await sql`
      SELECT id FROM admin_users WHERE email = 'freddykhoury@gmail.com'
    `;

    if (existing.length > 0) {
      return Response.json({ message: "Admin user already exists" });
    }

    // Hash the password (argon2)
    const hashedPassword = await hash("121314");

    // Add all roles (full access) - standardized role names
    const roles = ["backend", "orders", "product_status"];

    // Create user + roles in a single SQL statement (atomic)
    const created = await sql(
      `
      WITH new_user AS (
        INSERT INTO admin_users (name, email, password, branch_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, branch_id, is_active, created_at, updated_at
      ),
      inserted_roles AS (
        INSERT INTO admin_user_roles (admin_user_id, role)
        SELECT new_user.id, r.role
        FROM new_user
        CROSS JOIN unnest($5::text[]) AS r(role)
        RETURNING 1
      )
      SELECT * FROM new_user
      `,
      ["Freddy Khoury", "freddykhoury@gmail.com", hashedPassword, null, roles],
    );

    const user = Array.isArray(created) ? created[0] : null;

    return Response.json({
      user,
      message: "Initial admin user created successfully",
    });
  } catch (error) {
    console.error("Error creating initial admin user:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
