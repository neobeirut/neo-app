function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === "null") return true;
  return true;
}

export function corsHeaders(request) {
  let origin = null;
  if (request?.headers) {
    if (typeof request.headers.get === "function") {
      origin = request.headers.get("origin") || request.headers.get("Origin");
    } else if (typeof request.headers === "object") {
      origin = request.headers.origin || request.headers.Origin;
    }
  }

  const allowedOrigin = origin || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Phone, X-Auth-User-Id, x-admin-token, x-admin-id",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function corsOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export function corsJson(request, body, init = {}) {
  const headers = {
    ...(init.headers || {}),
    ...corsHeaders(request),
  };

  return Response.json(body, {
    ...init,
    headers,
  });
}
