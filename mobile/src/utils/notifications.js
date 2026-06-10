import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/utils/apiFetch";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { showNotificationPrePrompt } from "@/utils/notificationPermissionUIStore";

const PUSH_CONSENT_KEY = "@push_notifications_consent";

// --- New notification tracking store (v1) ---
const NOTIF_STATE_KEY = "@notif_state_v1";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function safeParseIso(iso) {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return null;
  return t;
}

function nowIso() {
  return new Date().toISOString();
}

function addMsToNowIso(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function defaultNotifState() {
  return {
    permissionStatus: "unknown", // "unknown" | "granted" | "denied"
    prePromptShownCount: 0,
    lastPromptAt: null,
    deferUntil: null,
    promptedAfterOrder: false,
    promptedInOrdersPage: false,
  };
}

async function readNotifState() {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STATE_KEY);
    if (!raw) return defaultNotifState();
    const parsed = JSON.parse(raw);
    return { ...defaultNotifState(), ...(parsed || {}) };
  } catch (e) {
    return defaultNotifState();
  }
}

async function writeNotifState(next) {
  try {
    await AsyncStorage.setItem(NOTIF_STATE_KEY, JSON.stringify(next));
  } catch (e) {
    // Silent error handling
  }
}

async function patchNotifState(patch) {
  const current = await readNotifState();
  const next = { ...current, ...(patch || {}) };
  await writeNotifState(next);
  return next;
}

function mapExpoPermissionToStatus(permission) {
  const status = String(permission?.status || "").toLowerCase();

  // Expo statuses: granted | denied | undetermined
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "unknown";
}

// Configure how notifications are handled when app is in foreground
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// --- Backward-compat keys (old flow) ---
// Check if user has given consent for push notifications
export async function hasPushConsent() {
  try {
    const consent = await AsyncStorage.getItem(PUSH_CONSENT_KEY);
    return consent === "true";
  } catch (e) {
    return false;
  }
}

// Save user's push notification consent
export async function setPushConsent(consent) {
  try {
    await AsyncStorage.setItem(PUSH_CONSENT_KEY, consent ? "true" : "false");
  } catch (e) {
    // Silent error handling
  }
}

// --- New public API (permission + tracking) ---
export async function getNotificationState() {
  return readNotifState();
}

export async function resetNotificationState() {
  try {
    await AsyncStorage.removeItem(NOTIF_STATE_KEY);
  } catch (e) {
    // Silent error handling
  }
}

// Sync permissionStatus based on OS state (NO system prompt)
export async function syncNotificationPermissionStatus() {
  if (Platform.OS === "web") {
    return patchNotifState({ permissionStatus: "unknown" });
  }

  try {
    const permission = await Notifications.getPermissionsAsync();
    const permissionStatus = mapExpoPermissionToStatus(permission);
    return patchNotifState({ permissionStatus });
  } catch (e) {
    return readNotifState();
  }
}

// Only used when the user explicitly taps "Enable" (pre-prompt primary or settings screen)
export async function requestPushNotificationPermission() {
  if (Platform.OS === "web") {
    return { permissionStatus: "unknown" };
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    const existingMapped = mapExpoPermissionToStatus(existing);

    // If already granted/denied, don't spam request again
    if (existingMapped === "granted") {
      const next = await patchNotifState({ permissionStatus: "granted" });
      return { permissionStatus: next.permissionStatus };
    }
    if (existingMapped === "denied") {
      const next = await patchNotifState({ permissionStatus: "denied" });
      return { permissionStatus: next.permissionStatus };
    }

    const requested = await Notifications.requestPermissionsAsync();
    const mapped = mapExpoPermissionToStatus(requested);
    const next = await patchNotifState({ permissionStatus: mapped });

    return { permissionStatus: next.permissionStatus };
  } catch (e) {
    return { permissionStatus: "unknown" };
  }
}

export async function openOSNotificationSettings() {
  try {
    // expo-linking provides openSettings on supported platforms
    await Linking.openSettings();
  } catch (e) {
    // Silent error handling
  }
}

function canShowPrePrompt(state) {
  if (!state) return false;

  if (state.permissionStatus !== "unknown") return false;
  if (Number(state.prePromptShownCount || 0) >= 3) return false;

  const lastPromptT = safeParseIso(state.lastPromptAt);
  if (lastPromptT && Date.now() - lastPromptT < SEVEN_DAYS_MS) return false;

  const deferUntilT = safeParseIso(state.deferUntil);
  if (deferUntilT && Date.now() < deferUntilT) return false;

  return true;
}

// Called by triggers (orders screen open / after order). This ONLY shows the custom pre-prompt.
export async function maybeShowNotificationPrePrompt(trigger) {
  if (Platform.OS === "web") return false;

  const current = await syncNotificationPermissionStatus();
  if (!canShowPrePrompt(current)) {
    return false;
  }

  // Trigger-specific one-time guards
  if (trigger === "afterOrder" && current.promptedAfterOrder) {
    return false;
  }

  if (trigger === "ordersPage" && current.promptedInOrdersPage) {
    return false;
  }

  const patch = {};
  if (trigger === "afterOrder") {
    patch.promptedAfterOrder = true;
  }
  if (trigger === "ordersPage") {
    patch.promptedInOrdersPage = true;
  }

  await patchNotifState(patch);
  showNotificationPrePrompt(trigger);
  return true;
}

export async function deferNotificationPrePrompt() {
  const next = await patchNotifState({
    prePromptShownCount:
      Number((await readNotifState()).prePromptShownCount || 0) + 1,
    lastPromptAt: nowIso(),
    deferUntil: addMsToNowIso(SEVEN_DAYS_MS),
  });
  return next;
}

// Register for push notifications and get token
// IMPORTANT: This must NOT show the system prompt.
// It only returns a token if permissions are already granted.
export async function registerForPushNotifications() {
  // Skip on web
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const permission = await Notifications.getPermissionsAsync();
    const mapped = mapExpoPermissionToStatus(permission);

    if (mapped !== "granted") {
      return null;
    }

    // Set up Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B6B",
      });
    }

    // Get push token
    // In some builds, Expo requires an explicit EAS projectId.
    // We'll try without it first, then retry with a best-effort projectId.

    // Hardcoded project ID as fallback
    const HARDCODED_PROJECT_ID = "3116d5e0-932d-4e7f-bfd6-3c5b027341c8";

    const projectIdCandidates = [
      Constants.easConfig?.projectId,
      Constants.expoConfig?.extra?.eas?.projectId,
      Constants.expoConfig?.extra?.projectId,
      Constants.expoConfig?.extra?.expoClient?.projectId,
      Constants.expoConfig?.extra?.expo?.projectId,
      Constants.manifest2?.extra?.eas?.projectId,
      Constants.manifest2?.extra?.projectId,
      Constants.manifest?.extra?.eas?.projectId,
      Constants.manifest?.extra?.projectId,
      HARDCODED_PROJECT_ID, // Always include as fallback
    ].filter(Boolean);

    const projectId =
      projectIdCandidates.length > 0 ? String(projectIdCandidates[0]) : null;

    let token;
    try {
      // Preferred: let Expo infer project automatically when possible.
      token = await Notifications.getExpoPushTokenAsync();
    } catch (e) {
      // Retry with explicit projectId (required for many standalone builds)
      if (!projectId) {
        return null;
      }

      token = await Notifications.getExpoPushTokenAsync({ projectId });
    }

    return token?.data || null;
  } catch (error) {
    return null;
  }
}

// Save push token to backend
export async function savePushToken(token) {
  try {
    const response = await apiFetch("/api/users/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        push_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      // Silent error handling
    }
  } catch (error) {
    // Silent error handling
  }
}

// Set up notification listeners
export function setupNotificationListeners() {
  // Skip on web - notification listeners are not supported
  if (Platform.OS === "web") {
    return () => {}; // Return empty cleanup function
  }

  // Handle notification received
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      // Notification received - no logging in production
    },
  );

  // Handle notification tap
  const responseListener =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      // Navigate based on targetPage if provided
      if (data?.targetPage) {
        router.push(data.targetPage);
      } else if (data?.orderId) {
        // Fallback: navigate to profile for order notifications
        router.push("/(tabs)/profile");
      } else if (data?.eventId) {
        // Navigate to event detail if event ID is provided
        router.push(`/events/detail?id=${data.eventId}`);
      }
    });

  // Return cleanup function
  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}
