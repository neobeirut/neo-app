import sql from "@/app/api/utils/sql";

export async function GET(req) {
  try {
    // Fetch the favicon URL from the database
    const rows = await sql`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'website_icon_url'
      LIMIT 1
    `;

    const iconUrl = rows[0]?.setting_value;

    if (!iconUrl) {
      // If no icon is set, return a 404
      return new Response("No favicon set", { status: 404 });
    }

    // Fetch the actual image
    const imageResponse = await fetch(iconUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!imageResponse.ok) {
      console.error("Failed to fetch favicon from URL:", iconUrl);
      return new Response("Failed to fetch favicon", { status: 502 });
    }

    // Get the image data
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") || "image/png";

    // Serve the image with proper caching headers
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, must-revalidate", // Cache for 1 hour but revalidate
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (error) {
    console.error("Error fetching favicon:", error);
    return new Response("Error fetching favicon", {
      status: 500,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }
}
