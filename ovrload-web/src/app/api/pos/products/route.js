import sql from "../../utils/sql";

export async function GET() {
  try {
    // Fetch active categories
    const categoriesResult = await sql`
      SELECT id, name, image_url, display_order, is_active 
      FROM categories 
      WHERE is_active = true 
      ORDER BY display_order ASC, name ASC
    `;

    // Fetch products with customizations matching Admin definitions
    const productsResult = await sql`
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price::float as unit_price_usd, 
        p.image_url, 
        p.category_id,
        c.name as category_name,
        p.sort_order,
        p.status,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', pc.id,
            'customization_item_id', pc.customization_item_id,
            'name', COALESCE(ci.name, pc.ingredient),
            'ingredient', COALESCE(ci.name, pc.ingredient),
            'customization_type', COALESCE(ci.customization_type, pc.customization_type, 'addon'),
            'price', COALESCE(pc.price, ci.default_price, 0)::float,
            'option_group_name', COALESCE(
              ci.option_group_name,
              CASE 
                WHEN pc.customization_type = 'remove' THEN 'Remove Ingredients' 
                WHEN pc.customization_type = 'addon' THEN 'Add-ons' 
                ELSE 'Custom Options' 
              END
            ),
            'is_required', COALESCE(ci.is_required, false),
            'is_multi_select', COALESCE(ci.is_multi_select, true),
            'display_order', COALESCE(ci.display_order, 999)
          ) ORDER BY 
              CASE COALESCE(ci.customization_type, pc.customization_type)
                WHEN 'option' THEN 1
                WHEN 'remove' THEN 2
                ELSE 3
              END,
              COALESCE(ci.display_order, 999), 
              COALESCE(ci.name, pc.ingredient) ASC
          )
           FROM product_customizations pc
           LEFT JOIN customization_items ci ON pc.customization_item_id = ci.id
           WHERE pc.product_id = p.id 
             AND pc.is_active IS DISTINCT FROM FALSE
             AND (ci.id IS NULL OR ci.is_active IS DISTINCT FROM FALSE)
          ), '[]'::json
        ) as customizations
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'Available'
      ORDER BY COALESCE(c.display_order, 9999) ASC, c.name ASC, p.sort_order ASC, p.name ASC
    `;

    // Fetch app settings for channel discounts
    const settingsResult = await sql`
      SELECT setting_key, setting_value FROM app_settings
    `;
    const settingsObj = {};
    (settingsResult || []).forEach((row) => {
      settingsObj[row.setting_key] = row.setting_value;
    });

    return Response.json({
      categories: categoriesResult || [],
      products: productsResult || [],
      settings: {
        toters_discount_percent: parseFloat(settingsObj.toters_discount_percent || "15"),
        noknok_discount_percent: parseFloat(settingsObj.noknok_discount_percent || "15"),
        print_server_ip:   settingsObj.print_server_ip   || "",
        print_server_port: settingsObj.print_server_port || "9191",
      }
    });
  } catch (error) {
    console.error("Error in GET /api/pos/products:", error);
    return Response.json(
      { error: "Failed to fetch products for POS: " + error.message },
      { status: 500 }
    );
  }
}
