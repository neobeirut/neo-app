function isAllowedOrigin(origin) {
  if (!origin) return false;

  // In sandboxed iframes (like some Anything previews), the browser origin can be the literal string "null".
  // Treat it as allowed in dev/published previews so fetch() doesn't hard-fail.
  if (origin === "null") return true;

  // Anything dev servers
  if (origin.includes(".createdevserver.com")) return true;

  // Anything published apps
  if (origin.includes(".created.app")) return true;

  // Allow same-origin as configured app url in env (when present)
  const appUrl = process.env.APP_URL;
  if (appUrl && origin === appUrl.replace(/\/$/, "")) return true;

  return false;
}

export function corsHeaders(request) {
  const origin = request?.headers?.get?.("origin") || null;

  // In dev, be more permissive to support the Anything in-editor previews.
  const isProd =
    process.env.ENV === "production" || process.env.NODE_ENV === "production";

  // If we recognize the origin, reflect it.
  if (origin && isAllowedOrigin(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      // Add admin headers for admin panel authentication
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Auth-Phone, X-Auth-User-Id, x-admin-token, x-admin-id",
      "Access-Control-Allow-Credentials": "true",
    };
  }

  // For unknown origins in dev, allow without credentials.
  // This is needed for the Anything mobile web preview which can run under a proxy origin.
  if (!isProd) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      // Add admin headers for admin panel authentication
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Auth-Phone, X-Auth-User-Id, x-admin-token, x-admin-id",
    };
  }

  // In prod, omit CORS if we don't recognize the origin.
  return {};
}

export function corsJson(request, body, init = {}) {
  const headers = {
    ...(init.headers || {}),
    ...corsHeaders(request),
  };
  return Response.json(body, { ...init, headers });
}

export function corsOptions(request) {
  const headers = corsHeaders(request);
  return new Response(null, { status: 204, headers });
}
