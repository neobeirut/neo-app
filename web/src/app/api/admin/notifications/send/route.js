import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  console.log("\n=== PUSH NOTIFICATION SEND REQUEST START ===");
  console.log("[PUSH] Timestamp:", new Date().toISOString());

  try {
    console.log("[PUSH] Step 1: Checking admin authentication...");
    const adminUser = await getAdminWithRolesFromRequest(request);

    if (!adminUser) {
      console.error("[PUSH] ❌ Authentication failed - no admin user found");
      return corsJson(
        request,
        { error: "Unauthorized - Admin access required" },
        { status: 401 },
      );
    }

    console.log("[PUSH] ✅ Admin authenticated:", {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
    });

    console.log("[PUSH] Step 2: Parsing request body...");
    const body = await request.json();
    console.log("[PUSH] Request body:", JSON.stringify(body, null, 2));

    const { title, message, branchIds, targetPage, eventId } = body;

    if (!title || !message) {
      console.error("[PUSH] ❌ Validation failed - missing title or message");
      return corsJson(
        request,
        { error: "Title and message are required" },
        { status: 400 },
      );
    }

    console.log("[PUSH] ✅ Validation passed");
    console.log("[PUSH] Step 3: Processing branch selection...");

    // Determine which users to send to based on branches
    let users;

    // Convert branchIds to proper format for database storage
    const shouldSendToAll =
      !branchIds || branchIds.length === 0 || branchIds.includes("all");
    const dbBranchIds = shouldSendToAll
      ? null
      : branchIds.filter((id) => id !== "all").map((id) => parseInt(id, 10));

    console.log("[PUSH] Branch selection:", {
      shouldSendToAll,
      dbBranchIds,
      originalBranchIds: branchIds,
    });

    console.log("[PUSH] Step 4: Fetching target users from database...");

    if (shouldSendToAll) {
      users = await sql`
        SELECT DISTINCT u.id, u.name, u.email, b.name as branch_name
        FROM auth_users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.is_active = true
      `;
      console.log("[PUSH] Fetched all active users:", users.length);
    } else {
      users = await sql`
        SELECT DISTINCT u.id, u.name, u.email, b.name as branch_name
        FROM auth_users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.branch_id = ANY(${dbBranchIds}::integer[])
          AND u.is_active = true
      `;
      console.log("[PUSH] Fetched users for branches:", users.length);
    }

    if (users.length === 0) {
      console.error("[PUSH] ❌ No users found for selected branches");
      return corsJson(
        request,
        { error: "No users found for selected branches" },
        { status: 404 },
      );
    }

    console.log("[PUSH] ✅ Found users:", users.length);
    console.log(
      "[PUSH] Sample users:",
      users.slice(0, 3).map((u) => ({ id: u.id, email: u.email })),
    );

    console.log("[PUSH] Step 5: Fetching push tokens...");
    const userIds = users.map((u) => u.id);
    const tokens = await sql`
      SELECT user_id, token, platform
      FROM user_push_tokens
      WHERE user_id = ANY(${userIds}::integer[])
    `;

    console.log(
      `[PUSH] ✅ Found ${users.length} users, ${tokens.length} tokens`,
    );
    console.log(
      "[PUSH] Sample tokens:",
      tokens.slice(0, 3).map((t) => ({
        user_id: t.user_id,
        token_preview: t.token?.substring(0, 30) + "...",
        platform: t.platform,
      })),
    );

    if (tokens.length === 0) {
      console.error("[PUSH] ❌ No push tokens found");
      return corsJson(
        request,
        {
          error: "No push tokens found for users in selected branches",
          recipients: users.length,
        },
        { status: 404 },
      );
    }

    console.log("[PUSH] Step 6: Validating Expo token formats...");
    const validTokens = tokens.filter((token) => {
      const t = String(token.token || "");
      const isValid =
        t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");
      if (!isValid) {
        console.warn(
          `[PUSH] ⚠️  Invalid token format for user ${token.user_id}: ${t.substring(0, 30)}...`,
        );
      }
      return isValid;
    });

    console.log(
      `[PUSH] ✅ Valid tokens: ${validTokens.length}/${tokens.length}`,
    );

    if (validTokens.length === 0) {
      console.error("[PUSH] ❌ No valid Expo tokens found");
      return corsJson(
        request,
        {
          error:
            "No valid Expo push tokens found. Users may need to re-enable notifications in the app.",
          totalTokens: tokens.length,
          recipients: users.length,
        },
        { status: 400 },
      );
    }

    console.log("[PUSH] Step 7: Preparing notification data...");
    const notificationData = {
      title,
      body: message,
    };

    if (targetPage) {
      notificationData.data = { targetPage };
      if (eventId) {
        notificationData.data.eventId = eventId;
      }
    }

    console.log(
      "[PUSH] Notification data:",
      JSON.stringify(notificationData, null, 2),
    );

    console.log("[PUSH] Step 8: Building push messages...");
    const pushMessages = validTokens.map((token) => ({
      to: token.token,
      sound: "default",
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      priority: "high",
      channelId: "default",
    }));

    console.log(`[PUSH] Prepared ${pushMessages.length} push messages`);
    console.log(
      "[PUSH] Sample message:",
      JSON.stringify(pushMessages[0], null, 2),
    );

    // Group tokens by Expo project to avoid PUSH_TOO_MANY_EXPERIENCE_IDS error
    console.log("[PUSH] Step 9a: Grouping tokens by Expo project...");
    const tokensByProject = new Map();

    for (let i = 0; i < validTokens.length; i++) {
      const token = validTokens[i];
      const message = pushMessages[i];

      // Try to determine project ID by making a test request
      // We'll group them and let Expo tell us which project they belong to
      const tokenKey = token.token;
      if (!tokensByProject.has("default")) {
        tokensByProject.set("default", []);
      }
      tokensByProject.get("default").push({ token, message, index: i });
    }

    console.log(`[PUSH] Grouped into ${tokensByProject.size} project group(s)`);

    let successCount = 0;
    const results = [];
    const errors = [];
    const projectStats = {};

    // Send in batches of 100 per project
    for (const [projectId, projectTokens] of tokensByProject.entries()) {
      console.log(
        `\n[PUSH] === Processing project: ${projectId} (${projectTokens.length} tokens) ===`,
      );

      const projectMessages = projectTokens.map((pt) => pt.message);

      for (let i = 0; i < projectMessages.length; i += 100) {
        const batch = projectMessages.slice(i, i + 100);
        const batchTokenInfo = projectTokens.slice(i, i + 100);
        const batchNum = Math.floor(i / 100) + 1;
        const totalBatches = Math.ceil(projectMessages.length / 100);

        console.log(
          `\n[PUSH] === Batch ${batchNum}/${totalBatches} for ${projectId} (${batch.length} messages) ===`,
        );

        try {
          console.log("[PUSH] Sending HTTP request to Expo...");
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(batch),
          });

          console.log(
            `[PUSH] ✅ Expo HTTP response status: ${response.status}`,
          );
          console.log(
            `[PUSH] Response headers:`,
            Object.fromEntries(response.headers.entries()),
          );

          const responseText = await response.text();
          console.log(
            `[PUSH] Response body (first 1000 chars):`,
            responseText.substring(0, 1000),
          );

          let result;
          try {
            result = JSON.parse(responseText);
            console.log("[PUSH] ✅ Successfully parsed JSON response");
          } catch (parseError) {
            console.error(
              "[PUSH] ❌ Failed to parse Expo response as JSON:",
              parseError,
            );
            console.error("[PUSH] Raw response:", responseText);
            errors.push({
              batch: batchNum,
              project: projectId,
              error: `Invalid JSON response from Expo: ${parseError.message}`,
              responseText: responseText.substring(0, 200),
            });
            continue;
          }

          results.push(result);

          // Check if this is the PUSH_TOO_MANY_EXPERIENCE_IDS error
          if (result.errors && Array.isArray(result.errors)) {
            const multiProjectError = result.errors.find(
              (e) => e.code === "PUSH_TOO_MANY_EXPERIENCE_IDS",
            );

            if (multiProjectError) {
              console.error(
                "[PUSH] ❌ Multiple Expo projects detected in batch!",
              );
              console.error(
                "[PUSH] Project details:",
                multiProjectError.details,
              );

              // Split by actual projects and retry
              const projectGroups = {};
              for (const [experienceId, tokens] of Object.entries(
                multiProjectError.details,
              )) {
                console.log(
                  `[PUSH] Found ${tokens.length} tokens for project: ${experienceId}`,
                );
                projectGroups[experienceId] = tokens;
              }

              // Retry by sending to each project separately
              for (const [experienceId, expTokens] of Object.entries(
                projectGroups,
              )) {
                console.log(
                  `[PUSH] Retrying ${expTokens.length} tokens for project: ${experienceId}`,
                );

                const retryMessages = batch.filter((msg) =>
                  expTokens.includes(msg.to),
                );

                if (retryMessages.length === 0) continue;

                try {
                  const retryResponse = await fetch(
                    "https://exp.host/--/api/v2/push/send",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      body: JSON.stringify(retryMessages),
                    },
                  );

                  const retryText = await retryResponse.text();
                  const retryResult = JSON.parse(retryText);

                  console.log(
                    `[PUSH] Retry result for ${experienceId}:`,
                    retryResult,
                  );

                  // Process retry results
                  const retryData = Array.isArray(retryResult)
                    ? retryResult
                    : retryResult.data || [];
                  retryData.forEach((r, idx) => {
                    if (r.status === "ok") {
                      successCount++;
                      if (!projectStats[experienceId]) {
                        projectStats[experienceId] = { success: 0, failed: 0 };
                      }
                      projectStats[experienceId].success++;
                    } else if (r.status === "error") {
                      const errorDetail = {
                        token: retryMessages[idx].to.substring(0, 20) + "...",
                        project: experienceId,
                        error: r.message || r.details?.error || "Unknown error",
                        details: r.details,
                      };
                      errors.push(errorDetail);
                      console.error(
                        "[PUSH] ❌ Notification failed:",
                        errorDetail,
                      );
                      if (!projectStats[experienceId]) {
                        projectStats[experienceId] = { success: 0, failed: 0 };
                      }
                      projectStats[experienceId].failed++;
                    }
                  });

                  // Clean up invalid tokens
                  const invalidTokens = [];
                  retryData.forEach((r, idx) => {
                    if (
                      r.status === "error" &&
                      (r.details?.error === "DeviceNotRegistered" ||
                        r.message?.includes("not registered"))
                    ) {
                      invalidTokens.push(retryMessages[idx].to);
                    }
                  });

                  if (invalidTokens.length > 0) {
                    console.log(
                      `[PUSH] Cleaning up ${invalidTokens.length} invalid tokens from ${experienceId}`,
                    );
                    await sql`
                      DELETE FROM user_push_tokens
                      WHERE token = ANY(${invalidTokens}::text[])
                    `;
                  }
                } catch (retryError) {
                  console.error(
                    `[PUSH] ❌ Retry failed for ${experienceId}:`,
                    retryError,
                  );
                  errors.push({
                    project: experienceId,
                    error: `Retry failed: ${retryError.message}`,
                  });
                }
              }

              continue; // Skip normal processing since we handled it with retries
            }
          }

          console.log("[PUSH] Parsed result structure:", {
            isArray: Array.isArray(result),
            hasData: "data" in result,
            dataIsArray: result.data ? Array.isArray(result.data) : false,
            keys: Object.keys(result),
          });

          // Handle both array and object responses
          let responseData = result.data || result;
          if (Array.isArray(result)) {
            responseData = result;
            console.log("[PUSH] Using array format response");
          } else if (result.data && Array.isArray(result.data)) {
            responseData = result.data;
            console.log("[PUSH] Using data property response");
          } else {
            console.error("[PUSH] ❌ Unexpected response structure");
            errors.push({
              batch: batchNum,
              project: projectId,
              error: "Unexpected response format",
              response: result,
            });
            continue;
          }

          console.log(`[PUSH] Processing ${responseData.length} responses...`);

          // Count successful sends and track errors
          responseData.forEach((r, idx) => {
            if (r.status === "ok") {
              successCount++;
              if (!projectStats[projectId]) {
                projectStats[projectId] = { success: 0, failed: 0 };
              }
              projectStats[projectId].success++;
            } else if (r.status === "error") {
              const errorDetail = {
                token: batch[idx].to.substring(0, 20) + "...",
                project: projectId,
                error: r.message || r.details?.error || "Unknown error",
                details: r.details,
              };
              errors.push(errorDetail);
              console.error("[PUSH] ❌ Notification failed:", errorDetail);
              if (!projectStats[projectId]) {
                projectStats[projectId] = { success: 0, failed: 0 };
              }
              projectStats[projectId].failed++;
            } else {
              console.warn("[PUSH] ⚠️  Unknown status:", r);
              errors.push({
                token: batch[idx].to.substring(0, 20) + "...",
                project: projectId,
                error: "Unknown response status",
                status: r.status,
                response: r,
              });
            }
          });

          console.log(
            `[PUSH] Batch ${batchNum} complete: ${successCount} total successful so far`,
          );

          // Clean up invalid tokens
          const invalidTokens = [];
          responseData.forEach((r, idx) => {
            if (
              r.status === "error" &&
              (r.details?.error === "DeviceNotRegistered" ||
                r.message?.includes("not registered"))
            ) {
              invalidTokens.push(batch[idx].to);
            }
          });

          if (invalidTokens.length > 0) {
            console.log(
              `[PUSH] Cleaning up ${invalidTokens.length} invalid tokens`,
            );
            await sql`
            DELETE FROM user_push_tokens
            WHERE token = ANY(${invalidTokens}::text[])
          `;
          }
        } catch (error) {
          console.error(`[PUSH] ❌ Error sending batch ${batchNum}:`, error);
          console.error("[PUSH] Error stack:", error.stack);
          results.push({ error: error.message });
          errors.push({
            batch: batchNum,
            project: projectId,
            error: error.message,
            stack: error.stack,
          });
        }
      }
    }

    console.log(`\n[PUSH] Step 10: All batches complete`);
    console.log(
      `[PUSH] Final stats: ${successCount}/${validTokens.length} notifications sent`,
    );
    console.log(`[PUSH] Stats by project:`, projectStats);

    console.log("[PUSH] Step 11: Storing notification in history...");
    const [notification] = await sql`
      INSERT INTO admin_push_notifications (
        title, message, branch_ids, target_page, event_id, sent_by, recipients_count, successful_sends
      )
      VALUES (
        ${title}, 
        ${message}, 
        ${dbBranchIds},
        ${targetPage || null}, 
        ${eventId || null}, 
        ${adminUser.id}, 
        ${users.length},
        ${successCount}
      )
      RETURNING *
    `;

    console.log("[PUSH] ✅ Notification saved to history:", notification.id);

    const responsePayload = {
      success: successCount > 0,
      notification,
      stats: {
        totalUsers: users.length,
        totalTokens: tokens.length,
        validTokens: validTokens.length,
        successfulSends: successCount,
        failedSends: validTokens.length - successCount,
      },
      errors: errors.length > 0 ? errors : undefined,
      results: results.length <= 5 ? results : results.slice(0, 5),
    };

    console.log("[PUSH] ✅ SUCCESS - Returning response");
    console.log(
      "[PUSH] Response payload:",
      JSON.stringify(responsePayload, null, 2),
    );
    console.log("=== PUSH NOTIFICATION SEND REQUEST END ===\n");

    return corsJson(request, responsePayload);
  } catch (error) {
    console.error("\n[PUSH] ❌❌❌ FATAL ERROR ❌❌❌");
    console.error("[PUSH] Error message:", error.message);
    console.error("[PUSH] Error stack:", error.stack);
    console.error("[PUSH] Error name:", error.name);
    console.error("=== PUSH NOTIFICATION SEND REQUEST FAILED ===\n");

    return corsJson(
      request,
      { error: `Failed to send notifications: ${error.message}` },
      { status: 500 },
    );
  }
}
