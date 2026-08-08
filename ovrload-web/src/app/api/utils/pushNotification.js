import sql from "./sql";

/**
 * Sends a push notification to a specific user via Expo.
 * Automatically handles fetching push tokens for the user and cleaning up invalid ones.
 * 
 * @param {number} userId - The database ID of the user.
 * @param {object} payload - The notification payload.
 * @param {string} payload.title - The title of the notification.
 * @param {string} payload.body - The message body.
 * @param {object} [payload.data] - Optional metadata (e.g. targetPage).
 * @returns {Promise<{success: boolean, sentCount: number, error: string|null}>}
 */
export async function sendPushNotificationToUser(userId, { title, body, data }) {
  console.log(`[push-notification] Sending push to user ${userId}...`);
  try {
    const tokens = [];

    // 1. Fetch user's push tokens from user_push_tokens table (with fallback)
    try {
      const rows = await sql`
        SELECT token, platform
        FROM user_push_tokens
        WHERE user_id = ${Number(userId)}
      `;
      for (const r of rows) {
        if (r.token) {
          tokens.push({ token: String(r.token), platform: r.platform });
        }
      }
    } catch (tblErr) {
      console.error("[push-notification] Failed to query user_push_tokens table:", tblErr.message);
    }

    // 2. Fetch legacy token from auth_users table
    try {
      const [user] = await sql`
        SELECT push_token
        FROM auth_users
        WHERE id = ${Number(userId)}
        LIMIT 1
      `;
      if (user?.push_token) {
        const legacy = String(user.push_token);
        if (!tokens.some(t => t.token === legacy)) {
          tokens.push({ token: legacy, platform: null });
        }
      }
    } catch (userErr) {
      console.error("[push-notification] Failed to query legacy push_token:", userErr.message);
    }

    if (tokens.length === 0) {
      console.log(`[push-notification] No push tokens found for user ${userId}`);
      return { success: false, sentCount: 0, error: "No push tokens found" };
    }

    // 2. Filter valid tokens (allowing mock token for dev testing)
    const validTokens = tokens.filter((token) => {
      const t = String(token.token || "");
      return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[") || t === "expo-push-token";
    });

    if (validTokens.length === 0) {
      console.log(`[push-notification] No valid Expo push tokens found for user ${userId}`);
      return { success: false, sentCount: 0, error: "No valid Expo push tokens found" };
    }

    // 3. Build messages
    const realMessages = [];
    let mockSuccessCount = 0;

    validTokens.forEach((token) => {
      if (token.token === "expo-push-token") {
        console.log(`[push-notification] (MOCK TEST) Push notification that would be sent to user ${userId}:`, {
          title,
          body,
          data
        });
        mockSuccessCount++;
      } else {
        realMessages.push({
          to: token.token,
          sound: "default",
          title,
          body,
          data: data || {},
          priority: "high",
          channelId: "default",
        });
      }
    });

    if (realMessages.length === 0) {
      console.log(`[push-notification] Mock push notification processed successfully (sent: ${mockSuccessCount})`);
      return { success: true, sentCount: mockSuccessCount, error: null };
    }

    // 4. Send to Expo
    console.log(`[push-notification] Posting ${realMessages.length} messages to Expo...`);
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(realMessages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[push-notification] Expo API error: ${response.status} - ${errorText}`);
      return { success: false, sentCount: 0, error: `Expo API error: ${response.status}` };
    }

    const result = await response.json();
    const responseData = result.data || result;
    let successCount = 0;
    const invalidTokens = [];

    if (Array.isArray(responseData)) {
      responseData.forEach((r, idx) => {
        if (r.status === "ok") {
          successCount++;
        } else if (r.status === "error") {
          console.error(`[push-notification] Token push failed:`, r.message);
          if (r.details?.error === "DeviceNotRegistered" || r.message?.includes("not registered")) {
            invalidTokens.push(realMessages[idx].to);
          }
        }
      });
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      console.log(`[push-notification] Cleaning up ${invalidTokens.length} unregistered tokens...`);
      await sql`
        DELETE FROM user_push_tokens
        WHERE token = ANY(${invalidTokens}::text[])
      `;
    }

    console.log(`[push-notification] Push notifications sent: ${successCount}/${validTokens.length}`);
    return { success: successCount > 0 || mockSuccessCount > 0, sentCount: successCount + mockSuccessCount, error: null };
  } catch (error) {
    console.error(`[push-notification] Unexpected error sending push:`, error);
    return { success: false, sentCount: 0, error: error.message };
  }
}

/**
 * Sends a push notification to all registered admin devices for a branch (or HQ if branchId is null) via Expo.
 */
export async function sendPushNotificationToBranchAdmins(branchId, { title, body, data }) {
  console.log(`[push-notification] Sending push to branch ${branchId} admins...`);
  try {
    // 1. Fetch branch admin push tokens
    let tokens;
    if (branchId) {
      tokens = await sql`
        SELECT apt.token, apt.platform
        FROM admin_push_tokens apt
        JOIN admin_users au ON apt.admin_user_id = au.id
        WHERE (au.branch_id = ${Number(branchId)} OR au.branch_id IS NULL) AND au.is_active = true
`;
    } else {
      // HQ admins (no branch_id assigned)
      tokens = await sql`
        SELECT apt.token, apt.platform
        FROM admin_push_tokens apt
        JOIN admin_users au ON apt.admin_user_id = au.id
        WHERE au.branch_id IS NULL AND au.is_active = true
`;
    }

    if (tokens.length === 0) {
      console.log(`[push-notification] No admin push tokens found for branch ${branchId}`);
      return { success: false, sentCount: 0, error: "No push tokens found" };
    }

    // 2. Filter valid tokens (allowing mock token for dev testing)
    const validTokens = tokens.filter((token) => {
      const t = String(token.token || "");
      return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[") || t === "expo-push-token";
    });

    if (validTokens.length === 0) {
      console.log(`[push-notification] No valid Expo push tokens found for branch ${branchId}`);
      return { success: false, sentCount: 0, error: "No valid Expo push tokens found" };
    }

    // 3. Build messages
    const realMessages = [];
    let mockSuccessCount = 0;

    validTokens.forEach((token) => {
      if (token.token === "expo-push-token") {
        console.log(`[push-notification] (MOCK TEST ADMIN) Push notification that would be sent to branch ${branchId} admins:`, {
          title,
          body,
          data
        });
        mockSuccessCount++;
      } else {
        realMessages.push({
          to: token.token,
          sound: "default",
          title,
          body,
          data: data || {},
          priority: "high",
          channelId: "orders-channel",
          badge: 1,
          _contentAvailable: true,
        });
      }
    });

    if (realMessages.length === 0) {
      console.log(`[push-notification] Mock admin push notification processed successfully (sent: ${mockSuccessCount})`);
      return { success: true, sentCount: mockSuccessCount, error: null };
    }

    // 4. Send to Expo
    console.log(`[push-notification] Posting ${realMessages.length} admin messages to Expo...`);
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(realMessages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[push-notification] Expo Admin API error: ${response.status} - ${errorText}`);
      return { success: false, sentCount: 0, error: `Expo API error: ${response.status}` };
    }

    const result = await response.json();
    const responseData = result.data || result;
    let successCount = 0;
    const invalidTokens = [];

    if (Array.isArray(responseData)) {
      responseData.forEach((r, idx) => {
        if (r.status === "ok") {
          successCount++;
        } else if (r.status === "error") {
          console.error(`[push-notification] Token push failed:`, r.message);
          if (r.details?.error === "DeviceNotRegistered" || r.message?.includes("not registered")) {
            invalidTokens.push(realMessages[idx].to);
          }
        }
      });
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      console.log(`[push-notification] Cleaning up ${invalidTokens.length} unregistered admin tokens...`);
      await sql`
        DELETE FROM admin_push_tokens
        WHERE token = ANY(${invalidTokens}::text[])
`;
    }

    console.log(`[push-notification] Admin push notifications sent: ${successCount}/${validTokens.length}`);
    return { success: successCount > 0 || mockSuccessCount > 0, sentCount: successCount + mockSuccessCount, error: null };
  } catch (error) {
    console.error(`[push-notification] Unexpected error sending admin push:`, error);
    return { success: false, sentCount: 0, error: error.message };
  }
}
