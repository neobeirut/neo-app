import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdsParam = searchParams.get("product_ids");

    if (!productIdsParam) {
      return Response.json(
        { error: "product_ids parameter required" },
        { status: 400 },
      );
    }

    const productIds = productIdsParam
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    if (productIds.length === 0) {
      return Response.json({ products: {} });
    }

    // Single query to check which products have customizations
    const results = await sql`
      SELECT DISTINCT product_id
      FROM product_customizations
      WHERE product_id = ANY(${productIds})
        AND is_active = true
    `;

    // Create a map of product_id -> has_customizations
    const productsMap = {};
    productIds.forEach((id) => {
      productsMap[id] = false;
    });

    results.forEach((row) => {
      productsMap[row.product_id] = true;
    });

    return Response.json({ products: productsMap });
  } catch (error) {
    console.error("Error checking product customizations:", error);
    return Response.json(
      { error: "Failed to check customizations" },
      { status: 500 },
    );
  }
}
