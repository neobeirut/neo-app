/**
 * Resolves the base URL for OVRLOAD Commerce API endpoints.
 * When running in the browser on localhost / 127.0.0.1, uses relative path ""
 * to route through Vite's development proxy and prevent browser CORS blocks.
 */
export const COMMERCE_API_BASE: string = (
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_OVRLOAD_API_URL)
    ? import.meta.env.VITE_OVRLOAD_API_URL
    : ((typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.port === "5173"))
        ? ""
        : "https://ovrload-backend-production.up.railway.app")
).replace(/\/+$/, "");
