import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const updates = await request.json();

    if (!Array.isArray(updates)) {
      return corsJson(
        request,
        { error: "Invalid request format" },
        { status: 400 },
      );
    }

    // Update each branch's display_order
    for (const update of updates) {
      const { branchId, sortOrder } = update;

      await sql`
        UPDATE branches 
        SET display_order = ${sortOrder}
        WHERE id = ${branchId}
      `;
    }

    return corsJson(request, { success: true });
  } catch (error) {
    console.error("Error updating branch sort order:", error);
    return corsJson(
      request,
      { error: "Failed to update sort order" },
      { status: 500 },
    );
  }
}
