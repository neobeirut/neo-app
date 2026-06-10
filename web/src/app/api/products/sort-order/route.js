import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();

    // Support both single and batch updates
    const updates = Array.isArray(body) ? body : [body];

    // Update all products in a single transaction
    await sql.transaction(
      updates.map(
        ({ productId, sortOrder }) =>
          sql`UPDATE products SET sort_order = ${sortOrder} WHERE id = ${productId}`,
      ),
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating sort order:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
