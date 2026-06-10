import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { hash } from "argon2";

export async function POST(request) {
  try {
    const session = await auth();
    const sessionEmail = (session?.user?.email || "").trim().toLowerCase();

    if (!sessionEmail) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password || "";

    if (!email || !password) {
      return Response.json(
        { error: "Email and new password are required" },
        { status: 400 },
      );
    }

    if (email !== sessionEmail) {
      return Response.json(
        { error: "Signed-in email must match the admin email" },
        { status: 403 },
      );
    }

    if (String(password).length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const [admin] = await sql`
      SELECT id
      FROM admin_users
      WHERE LOWER(email) = ${email} AND is_active = true
      LIMIT 1
    `;

    if (!admin) {
      return Response.json(
        { error: "Admin account not found for that email" },
        { status: 404 },
      );
    }

    const hashedPassword = await hash(password);

    await sql`
      UPDATE admin_users
      SET password = ${hashedPassword}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${admin.id}
    `;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN-PASSWORD-RESET] session reset error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
