import { useAuth } from "../utils/auth/useAuth";
import { AuthModal } from "../utils/auth/useAuthModal";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  registerForPushNotifications,
  savePushToken,
  setupNotificationListeners,
  syncNotificationPermissionStatus,
  requestPushNotificationPermission,
  deferNotificationPrePrompt,
} from "../utils/notifications";
import useUser from "../utils/auth/useUser";
import { useBranchStore } from "../utils/branchStore";
import { phoneAuth } from "../utils/auth/phoneAuth";
import { Platform, View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Home } from "lucide-react-native";
import { useTheme } from "../utils/theme";
import NotificationPrePrompt from "../components/NotificationPrePrompt";
import AppNavigationBar from "../components/AppNavigationBar";
import {
  useNotificationPermissionUIStore,
  hideNotificationPrePrompt,
  showNotificationToast,
  clearNotificationToast,
} from "../utils/notificationPermissionUIStore";

// NOTE: In web preview, expo-splash-screen isn't meaningful and can throw.
// We keep the app stable by only using it on native.

// --- Push notification init guards (prevents loops in web preview / strict mode remounts) ---
let globalPushInitPromise = null;
let globalPushInitUserId = null;
let globalPushLastSavedToken = null;
let globalPushListenersCleanup = null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// GlobalHomeButton was removed in favor of AppNavigationBar

function AppContent() {
  const { data: user } = useUser();
  const { isAuthenticated, isReady } = useAuth();
  const qc = useQueryClient();
  const { colors } = useTheme();

  const prevPhoneRef = useRef(null);
  const prevAuthRef = useRef(null);
  const prevUserIdRef = useRef(null);

  const { prePromptVisible, toastMessage } = useNotificationPermissionUIStore();

  const [prePromptLoading, setPrePromptLoading] = useState(false);

  // IMPORTANT: prevent cart leakage between users.
  // If the signed-in user changes (or auth state changes), drop any cached cart queries.
  useEffect(() => {
    let mounted = true;

    const checkAndResetCartCache = async () => {
      try {
        const phone = await phoneAuth.getUserPhone();
        const currentUserIdRaw = user?.id;
        const currentUserId = currentUserIdRaw
          ? Number.parseInt(String(currentUserIdRaw), 10)
          : null;

        if (!mounted) return;

        const prevPhone = prevPhoneRef.current;
        const prevAuth = prevAuthRef.current;
        const prevUserId = prevUserIdRef.current;

        // CRITICAL BUG FIX:
        // Do NOT clear cart caches just because isAuthenticated toggled.
        // On real Android devices, auth can briefly flicker during storage revalidation,
        // which would wipe the cart and make it look like it "reset".
        //
        // Instead, only clear cart caches when we can prove the *user changed*.
        const phoneChanged =
          !!prevPhone && !!phone && String(prevPhone) !== String(phone);
        const userChanged =
          Number.isFinite(prevUserId) &&
          Number.isFinite(currentUserId) &&
          prevUserId !== currentUserId;

        if (phoneChanged || userChanged) {
          console.log("[ROOT] User changed -> clearing cached cart queries", {
            phoneChanged,
            userChanged,
            prevUserId,
            currentUserId,
          });
          qc.removeQueries({
            predicate: (query) => query.queryKey?.[0] === "cart",
          });
        }

        // Only update stored refs when we have concrete values.
        // This prevents transient null reads from SecureStore from breaking our user-change detection.
        if (phone) {
          prevPhoneRef.current = phone;
        }
        if (Number.isFinite(currentUserId)) {
          prevUserIdRef.current = currentUserId;
        }
        prevAuthRef.current = !!isAuthenticated;
      } catch (e) {
        console.error("[ROOT] Error checking phone auth state:", e);
      }
    };

    checkAndResetCartCache();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.id, qc]);

  // Keep permissionStatus in sync after login (NO system prompt)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const signedIn = isReady && !!isAuthenticated && !!user?.id;
    if (!signedIn) return;

    syncNotificationPermissionStatus().catch(() => null);
  }, [isReady, isAuthenticated, user?.id]);

  const onDismissPrePrompt = useCallback(async () => {
    try {
      await deferNotificationPrePrompt();
    } catch (e) {
      console.error("[notif] defer error:", e);
    } finally {
      hideNotificationPrePrompt();
    }
  }, []);

  const onEnableFromPrePrompt = useCallback(async () => {
    if (prePromptLoading) return;

    try {
      setPrePromptLoading(true);

      const { permissionStatus } = await requestPushNotificationPermission();

      if (permissionStatus !== "granted") {
        hideNotificationPrePrompt();
        showNotificationToast(
          "You can enable notifications anytime in Profile > Notification settings.",
        );
        return;
      }

      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(token);
      }

      hideNotificationPrePrompt();
    } catch (e) {
      console.error("[notif] enable from preprompt error:", e);
      hideNotificationPrePrompt();
    } finally {
      setPrePromptLoading(false);
    }
  }, [prePromptLoading]);

  // Push notifications: initialize listeners + (if already granted) register token ONCE per signed-in user
  useEffect(() => {
    // Web preview can't receive push notifications; skip entirely.
    if (Platform.OS === "web") {
      return;
    }

    const signedIn = isReady && !!isAuthenticated && !!user?.id;

    // If the user signed out, cleanup listeners.
    if (!signedIn) {
      if (globalPushListenersCleanup) {
        try {
          globalPushListenersCleanup();
        } catch (e) {
          console.error("[PUSH] Error cleaning up listeners:", e);
        }
      }
      globalPushListenersCleanup = null;
      globalPushInitUserId = null;
      globalPushInitPromise = null;
      return;
    }

    // Already initialized and listeners attached for this user.
    if (globalPushInitUserId === user.id && globalPushListenersCleanup) {
      return;
    }

    // If an init is running (strict mode / remount), reuse it.
    if (globalPushInitPromise) {
      return;
    }

    globalPushInitPromise = (async () => {
      try {
        // Ensure we know the OS state (no prompt)
        await syncNotificationPermissionStatus();

        // Only get/save token if already granted (this does NOT trigger system prompt)
        const token = await registerForPushNotifications();

        if (token && token !== globalPushLastSavedToken) {
          await savePushToken(token);
          globalPushLastSavedToken = token;
          console.log("[PUSH] Push token saved");
        }

        // Attach listeners exactly once
        if (globalPushListenersCleanup) {
          try {
            globalPushListenersCleanup();
          } catch (e) {
            console.error("[PUSH] Error cleaning up old listeners:", e);
          }
        }
        globalPushListenersCleanup = setupNotificationListeners();

        globalPushInitUserId = user.id;
        console.log("[PUSH] Ready for user:", user.id);
      } catch (e) {
        console.error("[PUSH] Setup error:", e);
      } finally {
        globalPushInitPromise = null;
      }
    })();
  }, [isReady, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!toastMessage) return;

    const t = setTimeout(() => {
      clearNotificationToast();
    }, 3500);

    return () => clearTimeout(t);
  }, [toastMessage]);

  return (
    <>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureDirection: "horizontal",
          }}
        >
          {/* Let Expo Router automatically discover all routes */}
          <Stack.Screen name="select-branch" options={{ gestureEnabled: true }} />
        </Stack>
        <AppNavigationBar />

        <NotificationPrePrompt
          visible={prePromptVisible}
          colors={colors}
          loading={prePromptLoading}
          title="Stay updated"
          body="Enable notifications to get order updates, exclusive offers, and new menu drops."
          primaryLabel="Enable notifications"
          secondaryLabel="Not now"
          onEnable={onEnableFromPrePrompt}
          onNotNow={onDismissPrePrompt}
          onClose={onDismissPrePrompt}
        />

        {toastMessage ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 24,
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.85)",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                maxWidth: 520,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: "#FFFFFF",
                  textAlign: "center",
                  lineHeight: 18,
                }}
              >
                {toastMessage}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      <AuthModal />
    </>
  );
}

export default function RootLayout() {
  const { initiate, isReady } = useAuth();
  const { loadSelectedBranch } = useBranchStore();

  useEffect(() => {
    // Prevent auto-hide only on native; in web preview it can throw and cause reload loops.
    if (Platform.OS !== "web") {
      SplashScreen.preventAutoHideAsync().catch((e) => {
        console.warn("[SPLASH] preventAutoHideAsync failed:", e?.message);
      });
    }
  }, []);

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      // Load the saved branch from SecureStore
      loadSelectedBranch();

      if (Platform.OS !== "web") {
        SplashScreen.hideAsync().catch((e) => {
          console.warn("[SPLASH] hideAsync failed:", e?.message);
        });
      }
    }
  }, [isReady, loadSelectedBranch]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
