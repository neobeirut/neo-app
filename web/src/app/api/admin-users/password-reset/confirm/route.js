import sql from "@/app/api/utils/sql";
import crypto from "crypto";
import { hash } from "argon2";

export async function POST(request) {
  try {
    const body = await request.json();
    const token = (body?.token || "").trim();
    const password = body?.password || "";

    if (!token || !password) {
      return Response.json(
        { error: "Token and new password are required" },
        { status: 400 },
      );
    }

    if (String(password).length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Validate token
    const rows = await sql`
      SELECT prt.id as token_id, prt.admin_user_id
      FROM admin_password_reset_tokens prt
      JOIN admin_users au ON au.id = prt.admin_user_id
      WHERE prt.token_hash = ${tokenHash}
        AND prt.used_at IS NULL
        AND prt.expires_at > NOW()
        AND au.is_active = true
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Invalid or expired reset link" },
        { status: 400 },
      );
    }

    const { token_id: tokenId, admin_user_id: adminUserId } = rows[0];

    const hashedPassword = await hash(password);

    // IMPORTANT: Anything's sql.transaction expects an array of txn queries.
    await sql.transaction((txn) => [
      txn`
        UPDATE admin_users
        SET password = ${hashedPassword}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${adminUserId}
      `,
      txn`
        UPDATE admin_password_reset_tokens
        SET used_at = NOW()
        WHERE id = ${tokenId}
      `,
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN-PASSWORD-RESET] confirm error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
