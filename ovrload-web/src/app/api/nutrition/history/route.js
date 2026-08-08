import { corsJson, corsOptions } from "@/app/api/utils/cors";
import sql from "@/app/api/utils/sql";
import { resolveUserId } from "@/app/api/orders/utils/authHelpers";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const userId = await resolveUserId(request);
    
    if (!userId) {
      return corsJson(request, { error: "Unauthorized. Please sign in to view history." }, { status: 401 });
    }

    console.log("[nutrition-history] Fetching wellness history for user:", userId);

    const scans = await sql`
      SELECT * FROM wellness_scans
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    // Process scans to parse ingredients lists
    const processedScans = scans.map((scan) => {
      let parsedIngredients = [];
      if (scan.ingredients) {
        try {
          parsedIngredients = typeof scan.ingredients === "string"
            ? JSON.parse(scan.ingredients)
            : scan.ingredients;
        } catch (e) {
          console.warn("[nutrition-history] Failed to parse ingredients JSON:", scan.ingredients);
          // Fallback to comma separated parsing or empty array
          if (typeof scan.ingredients === "string") {
            parsedIngredients = scan.ingredients.split(",").map(i => i.trim());
          }
        }
      }

      return {
        ...scan,
        ingredients: parsedIngredients,
        confidence: scan.confidence ? Number(scan.confidence) : 0.95,
        calories: Number(scan.calories),
        protein_g: Number(scan.protein_g),
        carbs_g: Number(scan.carbs_g),
        fat_g: Number(scan.fat_g),
        fiber_g: Number(scan.fiber_g),
        wellness_score: Number(scan.wellness_score),
      };
    });

    return corsJson(request, processedScans);
  } catch (err) {
    console.error("[nutrition-history] Unexpected Error:", err);
    return corsJson(request, { error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return corsJson(request, { error: "Unauthorized. Please sign in to delete records." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get("id");

    if (!scanId) {
      return corsJson(request, { error: "Scan ID is required" }, { status: 400 });
    }

    console.log(`[nutrition-history] Deleting scan ID ${scanId} for user ID ${userId}`);

    const result = await sql`
      DELETE FROM wellness_scans
      WHERE id = ${scanId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return corsJson(
        request,
        { error: "Scan record not found or unauthorized to delete" },
        { status: 404 }
      );
    }

    return corsJson(request, { success: true, deletedId: result[0].id });
  } catch (err) {
    console.error("[nutrition-history] DELETE Error:", err);
    return corsJson(request, { error: err.message }, { status: 500 });
  }
}
