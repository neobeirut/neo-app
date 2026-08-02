import { Platform } from "react-native";

/**
 * Get the correct API URL for the current platform
 * - All platforms: Use relative paths (handled by bundler/proxy)
 */
export function getApiUrl(path) {
  // Always use relative paths - the bundler handles proxying
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  console.log("[API-URL] Platform:", Platform.OS);
  console.log("[API-URL] Path:", cleanPath);

  return cleanPath;
}
