import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

// Register an admin push token
export async function POST(request) {
  try {
    const adminUser = await getAdminFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { push_token, platform, updated_at } = await request.json().catch(() => ({}));

    if (!push_token) {
      return Response.json(
        { error: "Push token is required" },
        { status: 400 },
      );
    }

    const platformSafe = platform ? String(platform).slice(0, 32) : null;
    const updatedAtSafe = updated_at ? String(updated_at) : null;

    // Save the token to admin_push_tokens
    await sql`
      INSERT INTO admin_push_tokens (admin_user_id, token, platform, updated_at)
      VALUES (${adminUser.id}, ${String(push_token)}, ${platformSafe}, COALESCE(${updatedAtSafe}::timestamptz, now()))
      ON CONFLICT (admin_user_id, token)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        updated_at = CURRENT_TIMESTAMP
    `;

    return Response.json({
      message: "Admin push token saved successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error saving admin push token:", error);
    return Response.json(
      { error: "Failed to save push token", details: error.message },
      { status: 500 },
    );
  }
}

// GET endpoint to confirm push tokens for debug purposes
export async function GET(request) {
  try {
    const adminUser = await getAdminFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT token, platform, updated_at 
      FROM admin_push_tokens 
      WHERE admin_user_id = ${adminUser.id} 
      ORDER BY updated_at DESC 
      LIMIT 10
    `;

    return Response.json({
      admin_user_id: adminUser.id,
      tokens: rows || [],
    });
  } catch (error) {
    console.error("Error reading admin push tokens:", error);
    return Response.json(
      { error: "Failed to read push tokens", details: error.message },
      { status: 500 },
    );
  }
}
