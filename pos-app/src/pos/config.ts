/**
 * Standalone FLOW POS Configuration.
 * Fully decoupled from OVRLOAD.
 */
function resolveCommerceApiBase(): string {
  // If running in browser, use relative base "" to leverage Vite dev proxy and reverse proxy, avoiding CORS blocks from Railway backend
  if (typeof window !== "undefined") {
    return "";
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_OVRLOAD_API_URL) {
    return import.meta.env.VITE_OVRLOAD_API_URL.replace(/\/+$/, "");
  }
  return "https://ovrload-backend-production.up.railway.app";
}

export const HAS_COMMERCE_API: boolean = false;
export const COMMERCE_API_BASE: string = resolveCommerceApiBase();
export const DRIVER_DISPATCH_API_BASE: string = COMMERCE_API_BASE;

