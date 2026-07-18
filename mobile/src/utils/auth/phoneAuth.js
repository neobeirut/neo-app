import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { apiFetch } from "@/utils/apiFetch";
import { serverCartBackupStore } from "@/utils/serverCartBackupStore";

// Storage keys
const STORAGE_KEYS = {
  USER_PHONE: "userPhone",
  USER_DATA: "userData",
  APP_VERSION: "appVersion",
  FIRST_LAUNCH: "firstLaunch",
};

// Current app storage version - increment this to force clear old data
const CURRENT_STORAGE_VERSION = "1.0.0";

// In-memory cache to avoid SecureStore timing/flicker (common on Android)
let cachedPhone = null;
let cachedUser = null;

// Helper function to add timeout to fetch requests
const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
  return Promise.race([
    apiFetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout),
    ),
  ]);
};

export const phoneAuth = {
  // Initialize and validate stored auth data
  async initialize() {
    try {
      console.log("[PHONE AUTH INIT] Starting initialization");

      // Check if this is first launch or storage version mismatch
      const storedVersion = await SecureStore.getItemAsync(
        STORAGE_KEYS.APP_VERSION,
      );
      const isFirstLaunch = storedVersion !== CURRENT_STORAGE_VERSION;

      if (isFirstLaunch) {
        console.log(
          "[PHONE AUTH INIT] First launch or version mismatch, clearing storage",
        );
        await this.clearAll();
        await SecureStore.setItemAsync(
          STORAGE_KEYS.APP_VERSION,
          CURRENT_STORAGE_VERSION,
        );
        return { isAuthenticated: false, user: null };
      }

      // Validate existing auth data
      const phone = await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHONE);
      const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

      if (!phone || !userData) {
        console.log("[PHONE AUTH INIT] No stored credentials found");
        cachedPhone = null;
        cachedUser = null;
        return { isAuthenticated: false, user: null };
      }

      // Seed in-memory cache immediately so callers don't see transient null while validation runs
      cachedPhone = phone;
      try {
        cachedUser = JSON.parse(userData);
      } catch (e) {
        cachedUser = null;
      }

      // Validate credentials with server (with timeout and non-blocking)
      try {
        const isValid = await this.validateStoredCredentials(
          phone,
          JSON.parse(userData),
        );

        if (!isValid) {
          console.log("[PHONE AUTH INIT] Stored credentials invalid, clearing");
          await this.clearAll();
          return { isAuthenticated: false, user: null };
        }

        console.log("[PHONE AUTH INIT] Valid credentials found");
        return { isAuthenticated: true, user: JSON.parse(userData) };
      } catch (validationError) {
        console.warn(
          "[PHONE AUTH INIT] Validation failed, but continuing with cached data:",
          validationError.message,
        );
        // If validation fails but we have cached data, use it anyway
        // The app will work offline and will re-validate on next action
        return { isAuthenticated: true, user: JSON.parse(userData) };
      }
    } catch (error) {
      console.error("[PHONE AUTH INIT] Error during initialization:", error);
      // On any error, clear storage to be safe
      try {
        await this.clearAll();
      } catch (clearError) {
        console.error("[PHONE AUTH INIT] Error clearing storage:", clearError);
      }
      return { isAuthenticated: false, user: null };
    }
  },

  // Validate stored credentials against server
  async validateStoredCredentials(phone, userData) {
    try {
      if (!phone || !userData?.id) {
        return false;
      }

      console.log(
        "[PHONE AUTH] Validating credentials for phone:",
        phone,
        "user_id:",
        userData.id,
      );

      const response = await fetchWithTimeout(
        "/api/auth/phone-verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        },
        5000,
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Check if user exists and matches stored data
      if (!data.exists || !data.user || data.user.id !== userData.id) {
        console.log("[PHONE AUTH] User data mismatch or doesn't exist");
        return false;
      }

      // If backend returns a canonical phone, keep our stored phone consistent.
      const canonicalPhone = data?.user?.phone || phone;

      // Update stored user data with latest from server
      await SecureStore.setItemAsync(
        STORAGE_KEYS.USER_DATA,
        JSON.stringify(data.user),
      );

      // Also keep phone in sync (prevents format drift between subsystems)
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_PHONE, canonicalPhone);

      // Refresh memory cache
      cachedPhone = canonicalPhone;
      cachedUser = data.user;

      // Web preview fallback
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_PHONE, canonicalPhone);
        await AsyncStorage.setItem(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(data.user),
        );
      } catch (e) {
        // ignore
      }

      return true;
    } catch (error) {
      console.error("[PHONE AUTH] Error validating credentials:", error);
      throw error;
    }
  },

  // Check if user is logged in (without validation)
  async isAuthenticated() {
    try {
      if (cachedPhone) {
        return true;
      }
      const phone = await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHONE);
      return !!phone;
    } catch (error) {
      console.error("Error checking auth:", error);
      return false;
    }
  },

  // Get current user data
  async getCurrentUser() {
    try {
      if (cachedUser) {
        return cachedUser;
      }

      const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
      if (userData) {
        const parsed = JSON.parse(userData);
        cachedUser = parsed;
        return parsed;
      }

      // Web preview fallback
      if (Platform.OS === "web") {
        const legacy = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        const parsed = legacy ? JSON.parse(legacy) : null;
        if (parsed) {
          cachedUser = parsed;
        }
        return parsed;
      }

      return null;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  },

  // Get user phone
  async getUserPhone() {
    try {
      if (cachedPhone) {
        return cachedPhone;
      }

      const phone = await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHONE);
      if (phone) {
        cachedPhone = phone;
        return phone;
      }

      // Web preview fallback (SecureStore is not reliable on web)
      if (Platform.OS === "web") {
        const legacy = await AsyncStorage.getItem(STORAGE_KEYS.USER_PHONE);
        if (legacy) {
          cachedPhone = legacy;
        }
        return legacy || null;
      }

      return null;
    } catch (error) {
      console.error("Error getting phone:", error);
      // Web preview fallback
      if (Platform.OS === "web") {
        try {
          const legacy = await AsyncStorage.getItem(STORAGE_KEYS.USER_PHONE);
          if (legacy) {
            cachedPhone = legacy;
          }
          return legacy || null;
        } catch (e) {
          return null;
        }
      }
      return null;
    }
  },

  // Verify phone and get user data
  async verifyPhone(phone) {
    try {
      const response = await apiFetch("/api/auth/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.exists) {
        // IMPORTANT: store the canonical phone returned by the backend when available.
        // This prevents subtle cart/auth bugs caused by formatting differences.
        const canonicalPhone = data?.user?.phone || phone;

        await SecureStore.setItemAsync(STORAGE_KEYS.USER_PHONE, canonicalPhone);
        await SecureStore.setItemAsync(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(data.user),
        );

        // Update in-memory cache immediately
        cachedPhone = canonicalPhone;
        cachedUser = data.user;

        // Web preview fallback
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_PHONE, canonicalPhone);
          await AsyncStorage.setItem(
            STORAGE_KEYS.USER_DATA,
            JSON.stringify(data.user),
          );
        } catch (e) {
          // ignore
        }

        return data.user;
      }

      return null;
    } catch (error) {
      console.error("Error verifying phone:", error);
      return null;
    }
  },

  // Delete account (soft delete)
  async deleteAccount() {
    try {
      const phone = await SecureStore.getItemAsync(STORAGE_KEYS.USER_PHONE);

      if (!phone) {
        throw new Error("No phone number found");
      }

      console.log("[PHONE AUTH] Deleting account for phone:", phone);

      const response = await apiFetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("[PHONE AUTH] Delete account failed:", {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details,
          hint: data.hint,
        });

        // Create error object with details
        const error = new Error(data.error || "Failed to delete account");
        error.details = data.details;
        error.hint = data.hint;
        error.status = response.status;
        throw error;
      }

      console.log("[PHONE AUTH] Account deleted successfully");

      // Clear all local storage
      await this.clearAll();

      return true;
    } catch (error) {
      console.error("[PHONE AUTH] Error deleting account:", error);
      throw error;
    }
  },

  // Sign out (clear local data)
  async signOut() {
    try {
      console.log("[PHONE AUTH] Signing out, clearing all storage");
      await this.clearAll();
      return true;
    } catch (error) {
      console.error("Error signing out:", error);
      return false;
    }
  },

  // Clear all auth-related storage
  async clearAll() {
    try {
      console.log("[PHONE AUTH] Clearing all storage");
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_PHONE);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);

      cachedPhone = null;
      cachedUser = null;

      // Also clear the signed-in cart backup so we never show a previous user's items.
      try {
        await serverCartBackupStore.clearAllCarts();
      } catch (e) {
        // ignore
      }

      // Web preview fallback
      try {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_PHONE);
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      } catch (e) {
        // ignore
      }

      return true;
    } catch (error) {
      console.error("[PHONE AUTH] Error clearing storage:", error);
      return false;
    }
  },
};
