import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const adminUser = await getAdminWithRolesFromRequest(request);

    if (!adminUser) {
      return corsJson(
        request,
        { error: "Unauthorized - Admin access required" },
        { status: 401 },
      );
    }

    console.log(
      "[TOKEN_CLEANUP] Starting cleanup of old development tokens...",
    );

    // Get count before deletion
    const beforeCount = await sql`
      SELECT COUNT(*) as count
      FROM user_push_tokens
    `;

    console.log(`[TOKEN_CLEANUP] Total tokens before: ${beforeCount[0].count}`);

    // We can't directly identify tokens by project without testing them
    // So we'll delete tokens that are known to belong to the old project
    // based on the error we saw
    const oldProjectToken = "ExponentPushToken[5GYs1qDsMBy0S-7fiEgO8o]";

    // Get all tokens that might be from old project
    const allTokens = await sql`
      SELECT DISTINCT token, user_id
      FROM user_push_tokens
    `;

    console.log(`[TOKEN_CLEANUP] Checking ${allTokens.length} tokens...`);

    // We'll identify old tokens by trying to send to them
    // For now, just delete the specific token we know is bad
    const deletedTokens = await sql`
      DELETE FROM user_push_tokens
      WHERE token = ${oldProjectToken}
      RETURNING user_id, token
    `;

    const afterCount = await sql`
      SELECT COUNT(*) as count
      FROM user_push_tokens
    `;

    const affectedUserIds = [...new Set(deletedTokens.map((t) => t.user_id))];

    console.log(`[TOKEN_CLEANUP] Deleted ${deletedTokens.length} tokens`);
    console.log(`[TOKEN_CLEANUP] Affected ${affectedUserIds.length} users`);
    console.log(`[TOKEN_CLEANUP] Remaining tokens: ${afterCount[0].count}`);

    return corsJson(request, {
      success: true,
      deletedCount: deletedTokens.length,
      remainingCount: parseInt(afterCount[0].count),
      affectedUsers: affectedUserIds.length,
      message: `Successfully removed ${deletedTokens.length} old development tokens`,
    });
  } catch (error) {
    console.error("[TOKEN_CLEANUP] Error:", error);
    return corsJson(
      request,
      { error: `Failed to cleanup tokens: ${error.message}` },
      { status: 500 },
    );
  }
}
