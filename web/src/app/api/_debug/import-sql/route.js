import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

const VERSION = "2026-01-19-import-sql-v1";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const rows = await sql`SELECT 1 as ok`;
    return corsJson(request, {
      ok: true,
      version: VERSION,
      rows,
    });
  } catch (e) {
    console.error("[import-sql] error", e);
    return corsJson(
      request,
      {
        ok: false,
        version: VERSION,
        error: String(e?.message || e),
      },
      { status: 500 },
    );
  }
}
