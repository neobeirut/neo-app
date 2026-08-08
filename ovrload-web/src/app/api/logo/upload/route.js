import upload from "../../../api/utils/upload";
import sql from "../../../api/utils/sql";

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

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Preferred path (production-safe): client uploads via /_create/api/upload and then sends us the resulting URL.
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const rawUrl = (body?.url || "").trim();

      if (!rawUrl) {
        return Response.json({ error: "Missing url" }, { status: 400 });
      }

      if (!isHttpUrl(rawUrl)) {
        return Response.json({ error: "Invalid url" }, { status: 400 });
      }

      const now = new Date();

      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ('logo_url', ${rawUrl}, ${now})
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = ${rawUrl}, updated_at = ${now}
      `;

      return Response.json({
        success: true,
        rawUrl,
        url: buildDisplayUrl(rawUrl, now),
        updatedAt: now.toISOString(),
      });
    }

    // Legacy path: multipart form upload (may produce raw.createusercontent.com URLs which can be blocked by some browsers/CDNs)
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    const uploadResult = await upload({ buffer });

    if (!uploadResult.url) {
      return Response.json({ error: "Upload failed" }, { status: 500 });
    }

    const now = new Date();

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('logo_url', ${uploadResult.url}, ${now})
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = ${uploadResult.url}, updated_at = ${now}
    `;

    return Response.json({
      success: true,
      rawUrl: uploadResult.url,
      url: buildDisplayUrl(uploadResult.url, now),
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
