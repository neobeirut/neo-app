import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const result = await sql`
      SELECT setting_value FROM app_settings 
      WHERE setting_key = 'hero_slider_images'
    `;

    if (result.length === 0) {
      // Default images if none are set
      return Response.json({
        images: [
          {
            id: 1,
            url: "https://ucarecdn.com/4f78cc02-ceb3-4858-bff8-6b70095dc4b8/-/format/auto/",
            title: "Welcome to NEO Beirut",
            subtitle:
              "Experience the finest pastries, bakery items, and bistro cuisine",
          },
        ],
      });
    }

    const images = JSON.parse(result[0].setting_value);
    return Response.json({ images });
  } catch (error) {
    console.error("Error fetching hero slider images:", error);
    return Response.json(
      { error: "Failed to fetch hero slider images" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { images } = await request.json();

    if (!Array.isArray(images)) {
      return Response.json(
        { error: "Images must be an array" },
        { status: 400 },
      );
    }

    // Validate image structure
    for (const img of images) {
      if (!img.url || typeof img.url !== "string") {
        return Response.json(
          { error: "Each image must have a valid url" },
          { status: 400 },
        );
      }
    }

    const imagesJson = JSON.stringify(images);

    // Upsert the slider images
    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('hero_slider_images', ${imagesJson}, NOW())
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = ${imagesJson}, updated_at = NOW()
    `;

    return Response.json({
      success: true,
      images,
    });
  } catch (error) {
    console.error("Error saving hero slider images:", error);
    return Response.json(
      { error: "Failed to save hero slider images" },
      { status: 500 },
    );
  }
}
