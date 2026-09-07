import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import upload from "@/app/api/utils/upload";

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = request.headers.get("content-type") || "";

    // 1. If client provided a pre-hosted or uploaded URL
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      const { url, filename, mimeType } = body;
      if (!url) return Response.json({ error: "Missing media url" }, { status: 400 });

      return Response.json({
        ok: true,
        mediaUrl: url,
        filename: filename || "attachment",
        mimeType: mimeType || "application/octet-stream",
      });
    }

    // 2. Multipart form upload
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    const filename = file.name || "attachment";
    const mimeType = file.type || "application/octet-stream";

    let uploadResult;
    try {
      uploadResult = await upload({ buffer });
    } catch (e) {
      // Fallback: create base64 data url for smaller attachments or dev testing
      const b64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      return Response.json({
        ok: true,
        mediaUrl: b64,
        filename,
        mimeType,
      });
    }

    return Response.json({
      ok: true,
      mediaUrl: uploadResult?.url || "",
      filename,
      mimeType: uploadResult?.mimeType || mimeType,
    });
  } catch (error) {
    console.error("[whatsapp/media/upload POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
