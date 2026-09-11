/**
 * Resolves the base URL for OVRLOAD Commerce API endpoints.
 * When running in a browser during local development / testing, uses relative path ""
 * to route through Vite's development proxy and prevent browser CORS blocks.
 */
function resolveCommerceApiBase(): string {
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    // Any local development host/port or LAN IP (e.g. tablet on 192.168.x.x) routes through proxy
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.endsWith(".local") ||
      port === "5173" ||
      port === "3000"
    ) {
      return "";
    }
  }

  // If explicitly overridden via environment variable (e.g. deployed admin dashboard)
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_OVRLOAD_API_URL) {
    return import.meta.env.VITE_OVRLOAD_API_URL.replace(/\/+$/, "");
  }

  return "https://ovrload-backend-production.up.railway.app";
}

export const COMMERCE_API_BASE: string = resolveCommerceApiBase();

