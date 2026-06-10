import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(req) {
  try {
    const rows = await sql`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'website_icon_url'
      LIMIT 1
    `;

    return Response.json({
      url: rows[0]?.setting_value || null,
    });
  } catch (error) {
    console.error("Error fetching website icon:", error);
    return Response.json(
      { error: "Failed to fetch website icon" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    // Require admin authentication
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const imageUrl = (body?.url || "").trim();

    if (!imageUrl) {
      return Response.json({ error: "No URL provided" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (e) {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Save to database
    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('website_icon_url', ${imageUrl}, NOW())
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = ${imageUrl},
        updated_at = NOW()
    `;

    return Response.json({
      url: imageUrl,
      message: "Website icon uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading website icon:", error);
    return Response.json(
      { error: error.message || "Failed to upload website icon" },
      { status: 500 },
    );
  }
}
