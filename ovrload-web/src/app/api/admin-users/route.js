import sql from "@/app/api/utils/sql";
import { hash } from "argon2";

// GET all admin users
export async function GET(request) {
  try {
    const users = await sql`
      SELECT 
        au.id,
        au.name,
        au.email,
        au.branch_id,
        au.is_active,
        au.created_at,
        au.updated_at,
        b.name as branch_name,
        ARRAY_AGG(aur.role) as roles
      FROM admin_users au
      LEFT JOIN branches b ON au.branch_id = b.id
      LEFT JOIN admin_user_roles aur ON au.id = aur.admin_user_id
      WHERE au.is_active = true
      GROUP BY au.id, au.name, au.email, au.branch_id, au.is_active, au.created_at, au.updated_at, b.name
      ORDER BY au.created_at DESC
    `;

    return Response.json({ users });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST create new admin user
export async function POST(request) {
  try {
    const { name, email, password, branch_id, roles } = await request.json();

    const normalizedRoles = Array.from(
      new Set(
        (Array.isArray(roles) ? roles : [])
          .map((r) => String(r || "").trim())
          .filter(Boolean),
      ),
    );

    if (!name || !email || !password || normalizedRoles.length === 0) {
      return Response.json(
        { error: "Name, email, password, and at least one role are required" },
        { status: 400 },
      );
    }

    // Hash the password
    const hashedPassword = await hash(password);

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
      [
        name,
        String(email).trim().toLowerCase(),
        hashedPassword,
        branch_id || null,
        normalizedRoles,
      ],
    );

    const user = Array.isArray(created) ? created[0] : null;

    return Response.json({
      user,
      message: "Admin user created successfully",
    });
  } catch (error) {
    console.error("Error creating admin user:", error);
    if (error.message.includes("duplicate key")) {
      return Response.json({ error: "Email already exists" }, { status: 400 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT update admin user
export async function PUT(request) {
  try {
    const { id, name, email, password, branch_id, roles } =
      await request.json();

    if (!id) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    // Hash password if provided
    const hashedPassword = password ? await hash(password) : null;

    await sql.transaction((txn) => {
      const queries = [];

      // Build update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount}`);
        values.push(name);
        paramCount++;
      }
      if (email !== undefined) {
        updates.push(`email = $${paramCount}`);
        values.push(email);
        paramCount++;
      }
      if (hashedPassword) {
        updates.push(`password = $${paramCount}`);
        values.push(hashedPassword);
        paramCount++;
      }
      if (branch_id !== undefined) {
        updates.push(`branch_id = $${paramCount}`);
        values.push(branch_id || null);
        paramCount++;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updates.length > 0) {
        const updateQuery = `
          UPDATE admin_users
          SET ${updates.join(", ")}
          WHERE id = $${paramCount}
        `;
        values.push(id);
        queries.push(txn(updateQuery, values));
      }

      // Update roles if provided
      if (roles && Array.isArray(roles)) {
        // Delete existing roles
        queries.push(
          txn`DELETE FROM admin_user_roles WHERE admin_user_id = ${id}`,
        );

        // Insert new roles
        for (const role of roles) {
          queries.push(txn`
            INSERT INTO admin_user_roles (admin_user_id, role)
            VALUES (${id}, ${role})
          `);
        }
      }

      return queries;
    });

    return Response.json({ message: "Admin user updated successfully" });
  } catch (error) {
    console.error("Error updating admin user:", error);
    if (error.message.includes("duplicate key")) {
      return Response.json({ error: "Email already exists" }, { status: 400 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE admin user
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    await sql`
      UPDATE admin_users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return Response.json({ message: "Admin user deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin user:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
