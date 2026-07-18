import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    // Check admin authentication
    const adminUser = await getAdminWithRolesFromRequest(request);
    if (!adminUser) {
      return Response.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (!userId && !email) {
      return Response.json(
        { error: "Please provide userId or email" },
        { status: 400 },
      );
    }

    // Find the user
    let user;
    if (userId) {
      [user] = await sql`
        SELECT id, email, phone, is_active, push_token
        FROM auth_users
        WHERE id = ${parseInt(userId, 10)}
        LIMIT 1
      `;
    } else if (email) {
      [user] = await sql`
        SELECT id, email, phone, is_active, push_token
        FROM auth_users
        WHERE email = ${email}
        LIMIT 1
      `;
    }

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Get all push tokens for this user
    const tokens = await sql`
      SELECT token, platform, updated_at, created_at
      FROM user_push_tokens
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
    `;

    return Response.json({
      user_id: user.id,
      user_email: user.email,
      user_phone: user.phone,
      user_active: user.is_active,
      legacy_push_token: user.push_token,
      has_tokens: tokens.length > 0,
      tokens: tokens || [],
    });
  } catch (error) {
    console.error("Error in push token diagnostics:", error);
    return Response.json(
      { error: "Failed to get diagnostics", details: error.message },
      { status: 500 },
    );
  }
}
