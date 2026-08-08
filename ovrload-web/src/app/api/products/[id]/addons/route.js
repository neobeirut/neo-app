import sql from "@/app/api/utils/sql";

// Get addons for a specific product
export async function GET(request, { params }) {
  try {
    const { id } = params;

    // First try: per-product add-ons linked via product_customizations (preferred)
    // This matches how the Admin "Product Customizations" selector saves add-ons.
    let addons;

    try {
      const rows = await sql`
        SELECT 
          pc.id,
          pc.product_id,
          pc.ingredient AS name,
          pc.price,
          pc.is_active
        FROM product_customizations pc
        LEFT JOIN customization_items ci ON pc.customization_item_id = ci.id
        WHERE pc.product_id = ${id}
          AND pc.customization_item_id IS NOT NULL
          AND pc.customization_type = 'addon'
          AND pc.is_active IS DISTINCT FROM FALSE
          AND ci.is_active IS DISTINCT FROM FALSE
        ORDER BY pc.ingredient ASC
      `;

      addons = (rows || []).map((a) => ({
        id: a.id,
        product_id: a.product_id,
        name: a.name,
        price: a.price,
        is_active: true,
        image_url: null,
      }));
    } catch (e) {
      // ignore and fall through to legacy table
      console.error("Error fetching addons from product_customizations:", e);
      addons = null;
    }

    // Second try: legacy product_addons table (older admin flows)
    if (!addons || addons.length === 0) {
      const legacy = await sql`
        SELECT * FROM product_addons 
        WHERE product_id = ${id} AND is_active = true
        ORDER BY name ASC
      `;
      addons = legacy || [];
    }

    // IMPORTANT: Do not fall back to showing *all* global add-ons.
    // If you want an add-on to show for a product, link it to the product.
    return Response.json({ addons: addons || [] });
  } catch (error) {
    console.error("Error fetching product addons:", error);
    return Response.json(
      { error: "Failed to fetch product addons" },
      { status: 500 },
    );
  }
}
