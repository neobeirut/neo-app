import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const result = await sql`
      SELECT setting_value as url, updated_at
      FROM app_settings 
      WHERE setting_key = 'branch_background_url'
    `;

    if (result.length === 0) {
      return corsJson(
        request,
        { url: null, rawUrl: null, updatedAt: null },
        { headers: { "Cache-Control": "no-store" }, status: 200 },
      );
    }

    const rawUrl = result[0].url;
    const updatedAt = result[0].updated_at || null;

    const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    const proxiedUrl = rawUrl
      ? `/api/image-proxy?url=${encodeURIComponent(rawUrl)}&v=${encodeURIComponent(String(version))}`
      : null;

    // Return a display-safe URL (avoids CORP/hotlink issues in web + android)
    return corsJson(
      request,
      { url: proxiedUrl, rawUrl, updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Branch background fetch error:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request) {
  try {
    // Allow either a regular user session OR the lightweight admin header auth
    const session = await auth();
    const admin = session ? null : await getAdminFromRequest(request);

    if (!session && !admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url) {
      return corsJson(request, { error: "URL is required" }, { status: 400 });
    }

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('branch_background_url', ${url}, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET 
        setting_value = ${url},
        updated_at = CURRENT_TIMESTAMP
    `;

    return corsJson(request, { success: true, url });
  } catch (error) {
    console.error("Branch background update error:", error);
    return corsJson(
      request,
      { error: "Failed to update branch background" },
      { status: 500 },
    );
  }
}
