import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Bell,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { useTheme } from "../utils/theme";
import {
  getNotificationState,
  syncNotificationPermissionStatus,
  requestPushNotificationPermission,
  registerForPushNotifications,
  savePushToken,
  openOSNotificationSettings,
} from "../utils/notifications";
import { apiFetch } from "../utils/apiFetch";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [notifState, setNotifState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverTokens, setServerTokens] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      // Sync OS state first (no system prompt)
      await syncNotificationPermissionStatus();

      const current = await getNotificationState();
      setNotifState(current);

      // If signed-in headers are available, this will tell us whether the backend
      // actually has a push token saved.
      if (Platform.OS !== "web") {
        try {
          const r = await apiFetch("/api/users/push-token", { method: "GET" });
          if (r.ok) {
            const data = await r.json();
            setServerTokens(data);
          } else {
            setServerTokens(null);
          }
        } catch (e) {
          setServerTokens(null);
        }
      }
    } catch (e) {
      // Error handling without console
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const permissionStatus = String(notifState?.permissionStatus || "unknown");

  const statusLabel = useMemo(() => {
    if (permissionStatus === "granted") return "Granted";
    if (permissionStatus === "denied") return "Blocked";
    return "Off";
  }, [permissionStatus]);

  const statusHelp = useMemo(() => {
    if (permissionStatus === "granted") {
      return "You’ll receive order updates and (if enabled later) special offers.";
    }
    if (permissionStatus === "denied") {
      return "Notifications are blocked at the system level. You can enable them in your phone settings.";
    }
    return "Enable notifications to get order updates, exclusive offers, and new menu drops.";
  }, [permissionStatus]);

  const onEnable = useCallback(async () => {
    try {
      setLoading(true);

      if (Platform.OS === "web") {
        Alert.alert(
          "Not available in web preview",
          "Push notifications work on the installed app (iOS/Android).",
        );
        return;
      }

      // IMPORTANT: This is the only place where we allow the system prompt without our pre-prompt.
      // It is a user-initiated action on the settings screen.
      const { permissionStatus: nextStatus } =
        await requestPushNotificationPermission();

      if (nextStatus !== "granted") {
        await load();
        Alert.alert(
          "Notifications Not Enabled",
          "You can enable notifications anytime from Profile > Notification settings.",
        );
        return;
      }

      const token = await registerForPushNotifications();
      if (!token) {
        await load();
        Alert.alert(
          "Enabled, but device token missing",
          "Notifications are allowed, but this device did not return a push token. Please contact support if this issue persists.",
        );
        return;
      }

      await savePushToken(token);

      await load();
      Alert.alert("Notifications Enabled", "You're all set.");
    } catch (e) {
      Alert.alert("Error", "Could not enable notifications.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  // NEW: if the user enabled notifications from iOS Settings earlier,
  // permissionStatus will be 'granted' but we might still not have a token saved.
  const onRegisterDevice = useCallback(async () => {
    try {
      setLoading(true);

      if (Platform.OS === "web") {
        Alert.alert(
          "Not available in web preview",
          "Push notifications work on the installed app (iOS/Android).",
        );
        return;
      }

      const token = await registerForPushNotifications();
      if (!token) {
        await load();
        Alert.alert(
          "Couldn't get device token",
          "This device did not return a push token. Please contact support if this issue persists.",
        );
        return;
      }

      await savePushToken(token);
      await load();

      Alert.alert(
        "Device registered",
        "Your device was registered for order updates.",
      );
    } catch (e) {
      Alert.alert("Error", "Could not register this device.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  const onOpenSettings = useCallback(async () => {
    try {
      await openOSNotificationSettings();
    } catch (e) {
      // Error handling without console
    }
  }, []);

  const serverTokenCount = useMemo(() => {
    const list = serverTokens?.tokens;
    return Array.isArray(list) ? list.length : 0;
  }, [serverTokens]);

  const legacyTokenPresent = useMemo(() => {
    return !!serverTokens?.legacy_push_token;
  }, [serverTokens]);

  const hasAnyServerToken = useMemo(() => {
    return legacyTokenPresent || serverTokenCount > 0;
  }, [legacyTokenPresent, serverTokenCount]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 8 }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: colors.text,
              flex: 1,
            }}
          >
            Notification Settings
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary + "20",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Bell size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
              }}
            >
              Push Notifications
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Status: {statusLabel}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 20,
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: colors.text,
              marginBottom: 6,
            }}
          >
            {permissionStatus === "granted"
              ? "Notifications enabled"
              : permissionStatus === "denied"
                ? "Notifications blocked"
                : "Notifications off"}
          </Text>

          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.textSecondary,
              lineHeight: 18,
            }}
          >
            {statusHelp}
          </Text>

          {/* If permission is granted but we have no token saved, show a repair button */}
          {permissionStatus === "granted" && !hasAnyServerToken ? (
            <View style={{ marginTop: 14 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                Notifications are allowed, but this phone is not registered for
                pushes yet.
              </Text>

              <TouchableOpacity
                onPress={onRegisterDevice}
                disabled={loading}
                style={{
                  marginTop: 10,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  alignItems: "center",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: "#FFFFFF",
                  }}
                >
                  Register this device
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {permissionStatus === "unknown" ? (
            <TouchableOpacity
              onPress={onEnable}
              disabled={loading}
              style={{
                marginTop: 14,
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                alignItems: "center",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: "#FFFFFF",
                }}
              >
                Enable notifications
              </Text>
            </TouchableOpacity>
          ) : null}

          {permissionStatus === "denied" ? (
            <TouchableOpacity
              onPress={onOpenSettings}
              disabled={loading}
              style={{
                marginTop: 14,
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.separator,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              <SettingsIcon size={16} color={colors.text} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors.text,
                }}
              >
                Open Settings
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={load}
            disabled={loading}
            style={{
              marginTop: 12,
              alignItems: "center",
              paddingVertical: 8,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              Refresh status
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.textSecondary,
              lineHeight: 18,
            }}
          >
            We'll never spam you. You can manage notifications anytime from this
            screen.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
