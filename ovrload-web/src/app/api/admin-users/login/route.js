import sql from "@/app/api/utils/sql";
import { verify, hash } from "argon2";
import { createHash } from "crypto";
import { createAdminToken } from "@/app/api/utils/adminAuth";

function sha256Hex(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function looksLikeSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Get admin user with roles
    // NOTE: if the production DB accidentally contains multiple admin_users rows
    // that differ only by email casing, make the choice deterministic.
    const [user] = await sql`
      SELECT 
        au.id,
        au.name,
        au.email,
        au.password,
        au.branch_id,
        au.is_active,
        b.name as branch_name,
        ARRAY_AGG(aur.role) FILTER (WHERE aur.role IS NOT NULL) as roles
      FROM admin_users au
      LEFT JOIN branches b ON au.branch_id = b.id
      LEFT JOIN admin_user_roles aur ON au.id = aur.admin_user_id
      WHERE LOWER(au.email) = ${normalizedEmail} AND au.is_active = true
      GROUP BY au.id, au.name, au.email, au.password, au.branch_id, au.is_active, b.name
      ORDER BY au.id DESC
      LIMIT 1
    `;

    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const storedPassword = String(user.password || "");

    // Verify password:
    // - Normal case: argon2 hash
    // - Legacy case: sha256 hex hash (older init-admin code)
    // - Emergency recovery case: plain-text (one-time) password stored in DB.
    //   If a match occurs, we immediately re-hash and store it.
    let isValid = false;

    if (storedPassword.startsWith("$argon2")) {
      isValid = await verify(storedPassword, password);
    } else if (looksLikeSha256Hex(storedPassword)) {
      isValid = sha256Hex(password) === storedPassword;

      if (isValid) {
        try {
          const newHash = await hash(String(password));
          await sql`
            UPDATE admin_users
            SET password = ${newHash}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${user.id}
          `;
        } catch (rehashErr) {
          console.error(
            "Failed to migrate sha256 admin password to argon2:",
            rehashErr,
          );
        }
      }
    } else {
      // Plain-text fallback
      isValid = storedPassword === String(password);

      if (isValid) {
        try {
          const newHash = await hash(String(password));
          await sql`
            UPDATE admin_users
            SET password = ${newHash}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${user.id}
          `;
        } catch (rehashErr) {
          // If rehash fails, still allow login (but log it so we can fix)
          console.error(
            "Failed to re-hash admin password after plain-text login:",
            rehashErr,
          );
        }
      }
    }

    if (!isValid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Don't send password back
    const { password: _, ...userData } = user;

    // Signed admin token (used to authorize admin API calls)
    const adminToken = createAdminToken({ adminUserId: userData.id });

    return Response.json({
      user: userData,
      adminToken,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error logging in admin user:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
