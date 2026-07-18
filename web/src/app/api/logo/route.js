import sql from "../../api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

function isHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function buildDisplayUrl(rawUrl, updatedAt) {
  if (!rawUrl) {
    return null;
  }

  const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  const versionParam = "v=" + encodeURIComponent(String(version));

  const isUploadcare =
    typeof rawUrl === "string" && rawUrl.includes("ucarecdn.com");

  if (isUploadcare) {
    const joinChar = rawUrl.includes("?") ? "&" : "?";
    return rawUrl + joinChar + versionParam;
  }

  return (
    "/api/image-proxy?url=" + encodeURIComponent(rawUrl) + "&" + versionParam
  );
}

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const result = await sql`
      SELECT setting_value as url, updated_at
      FROM app_settings 
      WHERE setting_key = 'logo_url'
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

    const displayUrl = buildDisplayUrl(rawUrl, updatedAt);

    return corsJson(
      request,
      { url: displayUrl, rawUrl, updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Logo fetch error:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawUrl = (body?.url || "").trim();

    if (!rawUrl) {
      return corsJson(request, { error: "Missing url" }, { status: 400 });
    }

    if (!isHttpUrl(rawUrl)) {
      return corsJson(request, { error: "Invalid url" }, { status: 400 });
    }

    const now = new Date();

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('logo_url', ${rawUrl}, ${now})
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = ${rawUrl}, updated_at = ${now}
    `;

    const displayUrl = buildDisplayUrl(rawUrl, now);

    return corsJson(
      request,
      { url: displayUrl, rawUrl, updatedAt: now.toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Logo update error:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
