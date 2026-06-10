import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo } from "react";
import { create } from "zustand";
import { Modal, View } from "react-native";
import { useAuthModal, useAuthStore, authKey } from "./store";
import { phoneAuth } from "./phoneAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRedirectStore } from "../redirectStore";

// Prevent repeated init loops (web preview / React strict mode / remounts)
let globalInitiatePromise = null;

/**
 * This hook provides authentication functionality.
 * It may be easier to use the `useAuthModal` or `useRequireAuth` hooks
 * instead as those will also handle showing authentication to the user
 * directly.
 */
export const useAuth = () => {
  const { isReady, auth, setAuth } = useAuthStore();
  const { isOpen, close, open } = useAuthModal();
  const { consumeRedirect } = useRedirectStore();

  const initiate = useCallback(async () => {
    // If we've already initialized, don't do it again.
    if (useAuthStore.getState().isReady) {
      return;
    }

    // If an initialization is already running, reuse it.
    if (globalInitiatePromise) {
      return globalInitiatePromise;
    }

    globalInitiatePromise = (async () => {
      // Add overall timeout to prevent hanging.
      // IMPORTANT: ensure the timeout does NOT fire after a successful init.
      let didTimeout = false;
      let timeoutId = null;

      const initWithTimeout = async () => {
        try {
          console.log("[USE AUTH] Starting authentication initialization");

          // Initialize and validate phone auth first
          const phoneAuthResult = await phoneAuth.initialize();
          console.log("[USE AUTH] Phone auth result:", phoneAuthResult);

          // If the timeout already fired, don't update state again.
          if (didTimeout) {
            console.warn("[USE AUTH] Init finished after timeout; ignoring");
            return;
          }

          // Check regular auth (web-based) from SecureStore
          const authData = await SecureStore.getItemAsync(authKey);
          const regularAuth = authData ? JSON.parse(authData) : null;

          console.log("[USE AUTH] Regular auth found:", !!regularAuth);

          let finalAuth = null;

          // Prefer regular auth over phone auth if both exist
          if (regularAuth) {
            finalAuth = regularAuth;
            console.log("[USE AUTH] Using regular auth");
          } else if (phoneAuthResult.isAuthenticated) {
            finalAuth = {
              user: phoneAuthResult.user,
              phone: await phoneAuth.getUserPhone(),
            };
            console.log("[USE AUTH] Using phone auth");
          } else {
            console.log("[USE AUTH] No valid authentication found");
          }

          if (didTimeout) {
            console.warn("[USE AUTH] Init finished after timeout; ignoring");
            return;
          }

          useAuthStore.setState({
            auth: finalAuth,
            isReady: true,
          });

          console.log(
            "[USE AUTH] Authentication initialized, isAuthenticated:",
            !!finalAuth,
          );
        } catch (error) {
          console.error("[USE AUTH] Error during initiate:", error);

          // On error, clear everything and mark as ready with no auth
          try {
            await phoneAuth.clearAll();
          } catch (clearError) {
            console.error("[USE AUTH] Error clearing auth:", clearError);
          }

          if (!didTimeout) {
            useAuthStore.setState({
              auth: null,
              isReady: true,
            });
          }
        }
      };

      const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          didTimeout = true;
          console.warn(
            "[USE AUTH] ⚠️ Initialization timeout, forcing ready state",
          );
          useAuthStore.setState({
            auth: null,
            isReady: true,
          });
          resolve();
        }, 10000); // 10 second max wait
      });

      try {
        await Promise.race([initWithTimeout(), timeoutPromise]);
      } catch (error) {
        console.error(
          "[USE AUTH] Critical error during initialization:",
          error,
        );
        if (!didTimeout) {
          useAuthStore.setState({
            auth: null,
            isReady: true,
          });
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    })();

    try {
      return await globalInitiatePromise;
    } finally {
      // Allow later calls only if something explicitly resets isReady (rare)
      globalInitiatePromise = null;
    }
  }, []);

  useEffect(() => {}, []);

  const signIn = useCallback(() => {
    open({ mode: "signin" });
  }, [open]);

  const signUp = useCallback(() => {
    open({ mode: "signup" });
  }, [open]);

  const signOut = useCallback(async () => {
    console.log("[USE AUTH] Signing out");
    // Sign out from both systems and clear all storage
    await phoneAuth.signOut();
    await SecureStore.deleteItemAsync(authKey);
    setAuth(null);
    close();
    console.log("[USE AUTH] Sign out complete");
  }, [close, setAuth]);

  // Handle post-authentication redirect
  useEffect(() => {
    if (isReady && auth) {
      // Check if there's a pending redirect
      const redirect = consumeRedirect();

      if (redirect) {
        console.log(
          "[AUTH] User authenticated with pending redirect:",
          redirect,
        );

        // Small delay to ensure auth state is fully propagated
        setTimeout(() => {
          if (redirect.params) {
            router.push({
              pathname: redirect.route,
              params: redirect.params,
            });
          } else {
            router.push(redirect.route);
          }
        }, 150);
      }
    }
  }, [isReady, auth, consumeRedirect]);

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    initiate,
  };
};

/**
 * This hook will automatically open the authentication modal if the user is not authenticated.
 */
export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;
