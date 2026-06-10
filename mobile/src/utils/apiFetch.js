import { Platform } from "react-native";
import { useAuthStore } from "@/utils/auth/store";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Bump this when debugging EAS/Android builds so we can confirm the installed bundle is up to date.
export const API_FETCH_VERSION = "2026-01-18-cart-auth-storage-fallback-2";

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return "";

  let cleaned = String(baseUrl).trim();

  // Guard against env systems that stringify missing values
  if (cleaned === "undefined" || cleaned === "null") {
    return "";
  }

  // Some environments may provide the host without protocol
  if (
    cleaned &&
    !cleaned.startsWith("http://") &&
    !cleaned.startsWith("https://")
  ) {
    cleaned = `https://${cleaned.replace(/^\/\//, "")}`;
  }

  return cleaned.replace(/\/$/, "");
}

// Fallback for native builds when EXPO_PUBLIC_* base URLs are not injected.
// This should point at the published web app domain (which also hosts /api).
// NOTE: keep EXPO_PUBLIC_* as the first choice so dev/preview keeps using the dev server.
const PUBLISHED_WEB_BASE_URL = "https://gregarious-curiosity-production-653f.up.railway.app";

function getApiBaseUrl() {
  const proxyBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_PROXY_BASE_URL);
  const base = normalizeBaseUrl(process.env.EXPO_PUBLIC_BASE_URL);

  // Important: APP_URL/AUTH_URL are not guaranteed to be exposed to Expo builds.
  // Keep them as last-ditch candidates only.
  const appUrl = normalizeBaseUrl(process.env.APP_URL);
  const authUrl = normalizeBaseUrl(process.env.AUTH_URL);

  // Prefer the real base URL over the proxy URL.
  // The proxy host can be useful for some preview scenarios, but it is not always able to serve /api reliably.
  const candidate = base || proxyBase || appUrl || authUrl;

  // Important: on native builds, if nothing is injected, we must still return a real URL.
  // Returning undefined/empty will produce URLs like "undefined/api/..." and crash fetch on Android.
  const chosen =
    candidate && candidate.length > 0 ? candidate : PUBLISHED_WEB_BASE_URL;

  return chosen;
}

export function getChosenApiBaseUrl() {
  return getApiBaseUrl();
}

function resolveUrl(url) {
  // IMPORTANT: Always get a safe, non-empty base for native builds.
  const chosenBase = getApiBaseUrl();

  // Absolute URLs are always used as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // For API routes, we MUST hit the web backend (Anything hosts /api under the web dev server).
  // In mobile web preview, a relative "/api/*" points at the mobile preview origin which does not serve backend routes.
  if (url.startsWith("/api/")) {
    return `${chosenBase}${url}`;
  }

  // For native clients, also prefer the configured base for absolute-path URLs.
  if (Platform.OS !== "web" && url.startsWith("/")) {
    return `${chosenBase}${url}`;
  }

  // Otherwise, keep relative (works for in-app navigation and any same-origin assets).
  return url;
}

export function resolveApiUrl(url) {
  return resolveUrl(url);
}

export function normalizeRemoteImageUrl(uri) {
  if (!uri) return "";
  let cleaned = String(uri).trim();

  // Handle protocol-relative URLs
  if (cleaned.startsWith("//")) {
    cleaned = `https:${cleaned}`;
  }

  return cleaned;
}

export function getImageSource(uri, fallbackUri) {
  const normalized = normalizeRemoteImageUrl(uri);
  const fallback = normalizeRemoteImageUrl(fallbackUri);

  const chosen = normalized || fallback;
  if (!chosen) {
    return { uri: "" };
  }

  // If the URL is an absolute-path URL ("/api/..." or "/...") we must resolve it to a full URL on native.
  // Otherwise Android/iOS will treat it as a local file path and the image will fail to render.
  if (Platform.OS !== "web" && chosen.startsWith("/")) {
    return { uri: resolveUrl(chosen) };
  }

  // Proxy all external images through our backend to avoid CORS and hotlinking issues.
  // This applies to both web and mobile platforms.
  if (chosen.startsWith("http://") || chosen.startsWith("https://")) {
    const proxiedPath = `/api/image-proxy?url=${encodeURIComponent(chosen)}`;
    return { uri: resolveUrl(proxiedPath) };
  }

  return { uri: chosen };
}

/**
 * apiFetch
 * Adds Authorization header (Bearer JWT) when available.
 */
export async function apiFetch(url, options = {}) {
  const auth = useAuthStore.getState().auth;
  const jwt = auth?.jwt;

  const headers = {
    ...(options.headers || {}),
  };

  // Only attach Authorization when we have a JWT and caller didn't override
  if (jwt && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  // IMPORTANT (cart/auth fix):
  // For phone-auth users (no JWT), make identity available to backend via headers.
  // NOTE: sometimes the Zustand auth store can be temporarily empty during init/flicker;
  // so we also read the phone-auth values directly from storage as a fallback.
  let phone = auth?.phone || auth?.user?.phone;
  let userIdRaw = auth?.user?.id;

  // Storage fallback for phone OTP flows
  if (!phone || userIdRaw === null || userIdRaw === undefined) {
    try {
      const storedPhone = await SecureStore.getItemAsync("userPhone");
      const storedUserData = await SecureStore.getItemAsync("userData");
      const parsedUser = storedUserData ? JSON.parse(storedUserData) : null;

      if (!phone && storedPhone) {
        phone = storedPhone;
      }
      if ((userIdRaw === null || userIdRaw === undefined) && parsedUser?.id) {
        userIdRaw = parsedUser.id;
      }
    } catch (e) {
      // Web preview fallback (SecureStore not reliable)
      if (Platform.OS === "web") {
        try {
          const storedPhone = await AsyncStorage.getItem("userPhone");
          const storedUserData = await AsyncStorage.getItem("userData");
          const parsedUser = storedUserData ? JSON.parse(storedUserData) : null;

          if (!phone && storedPhone) {
            phone = storedPhone;
          }
          if (
            (userIdRaw === null || userIdRaw === undefined) &&
            parsedUser?.id
          ) {
            userIdRaw = parsedUser.id;
          }
        } catch (e2) {
          // ignore
        }
      }
    }
  }

  const userId =
    userIdRaw === null || userIdRaw === undefined
      ? null
      : String(userIdRaw).trim();

  const hasUserIdHeader =
    headers["X-Auth-User-Id"] ||
    headers["x-auth-user-id"] ||
    headers["X-AUTH-USER-ID"];

  const hasPhoneHeader =
    headers["X-Auth-Phone"] ||
    headers["x-auth-phone"] ||
    headers["X-AUTH-PHONE"];

  // Only attach for API calls (avoid leaking it to arbitrary hosts)
  const isApiCall =
    typeof url === "string" &&
    (url.startsWith("/api/") ||
      url.startsWith("http://") ||
      url.startsWith("https://"));

  // If we know the user's id (phone-auth flow returns it), send it.
  // This avoids any phone-format/duplicate-record ambiguity when resolving the user.
  if (userId && !hasUserIdHeader && isApiCall) {
    headers["X-Auth-User-Id"] = userId;
  }

  if (phone && !hasPhoneHeader && isApiCall) {
    headers["X-Auth-Phone"] = String(phone);
  }

  const finalUrl = resolveUrl(url);

  // In the Anything mobile *web preview*, cross-origin cookies are unreliable (and sometimes the iframe has an opaque origin).
  // Defaulting to credentials: "omit" avoids CORS "Failed to fetch" loops.
  // Native clients can keep using cookies when needed.
  let credentials = options.credentials;
  if (!credentials) {
    if (Platform.OS === "web") {
      credentials = "omit";
    } else {
      credentials = "include";
    }
  }

  const finalOptions = {
    ...options,
    headers,
    credentials,
  };

  if (Platform.OS === "web") {
    finalOptions.mode = finalOptions.mode || "cors";
  }

  try {
    return await fetch(finalUrl, finalOptions);
  } catch (error) {
    // Enhanced error logging for debugging "Failed to fetch" issues
    console.error("[apiFetch] Fetch failed:", {
      originalUrl: url,
      resolvedUrl: finalUrl,
      baseUrl: getApiBaseUrl(),
      platform: Platform.OS,
      error: error.message,
      hasAuth: !!jwt,
      hasPhone: !!phone,
      hasUserId: !!userId,
    });

    // Re-throw error for proper error handling
    throw error;
  }
}
