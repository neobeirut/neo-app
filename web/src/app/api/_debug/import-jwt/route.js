import { corsJson, corsOptions } from "@/app/api/utils/cors";

const VERSION = "2026-01-19-import-jwt-v1";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    let getToken;
    try {
      ({ getToken } = await import("@auth/core/jwt"));
    } catch (e) {
      console.error("[import-jwt] dynamic import failed", e);
      return corsJson(request, {
        ok: false,
        version: VERSION,
        importOk: false,
        hasJwt: false,
        jwtSub: null,
        error: String(e?.message || e),
      });
    }

    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: String(process.env.AUTH_URL || "").startsWith("https"),
    });

    return corsJson(request, {
      ok: true,
      version: VERSION,
      importOk: true,
      hasJwt: !!jwt,
      jwtSub: jwt?.sub || null,
    });
  } catch (e) {
    console.error("[import-jwt] error", e);
    return corsJson(
      request,
      {
        ok: false,
        version: VERSION,
        importOk: true,
        error: String(e?.message || e),
      },
      { status: 500 },
    );
  }
}
