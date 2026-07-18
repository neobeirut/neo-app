import sql from "@/app/api/utils/sql";

async function ensureProductOptionDefaultsTable() {
  // Non-destructive: create table if missing.
  await sql(`
    CREATE TABLE IF NOT EXISTS product_option_defaults (
      id bigserial PRIMARY KEY,
      product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      option_group_name text NOT NULL,
      customization_item_id integer NOT NULL REFERENCES customization_items(id) ON DELETE CASCADE,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      UNIQUE (product_id, option_group_name)
    )
  `);
}

// GET - Get customization items linked to this product
export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Ensure the per-product defaults table exists (safe even if already created)
    await ensureProductOptionDefaultsTable();

    // Get all active customization items
    const allItems = await sql`
      SELECT 
        id,
        name,
        customization_type,
        default_price,
        is_active,
        is_default,
        option_group_name,
        is_required,
        is_multi_select,
        display_order
      FROM customization_items
      WHERE is_active = true
      ORDER BY customization_type, option_group_name, display_order, name
    `;

    // Get items already linked to this product
    const linkedItems = await sql`
      SELECT 
        pc.customization_item_id,
        pc.price,
        pc.is_active
      FROM product_customizations pc
      WHERE pc.product_id = ${id} AND pc.customization_item_id IS NOT NULL
    `;

    // Map to get which items are selected
    const linkedMap = {};
    linkedItems.forEach((item) => {
      linkedMap[item.customization_item_id] = {
        price: item.price,
        is_active: item.is_active,
      };
    });

    // Per-product option defaults (override)
    const defaultsRows = await sql`
      SELECT option_group_name, customization_item_id
      FROM product_option_defaults
      WHERE product_id = ${id}
    `;

    const optionDefaults = {};
    (defaultsRows || []).forEach((row) => {
      if (!row?.option_group_name) return;
      optionDefaults[String(row.option_group_name)] = Number(
        row.customization_item_id,
      );
    });

    return Response.json({ allItems, linkedMap, optionDefaults });
  } catch (error) {
    console.error("Error fetching product customizations:", error);
    return Response.json(
      { error: "Failed to fetch product customizations" },
      { status: 500 },
    );
  }
}

// POST - Link customization items to product
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { selectedItems, optionDefaults } = await request.json();

    console.log("[LINK CUSTOMIZATIONS] Product ID:", id);
    console.log(
      "[LINK CUSTOMIZATIONS] Selected items:",
      JSON.stringify(selectedItems, null, 2),
    );

    // selectedItems should be an array of { customization_item_id, price, is_active }
    if (!Array.isArray(selectedItems)) {
      return Response.json(
        { error: "selectedItems must be an array" },
        { status: 400 },
      );
    }

    // Delete existing links
    console.log(
      "[LINK CUSTOMIZATIONS] Deleting existing links for product:",
      id,
    );
    await sql`
      DELETE FROM product_customizations
      WHERE product_id = ${id} AND customization_item_id IS NOT NULL
    `;

    // Insert new links
    let itemDetails = [];
    let itemDetailsMap = {};

    if (selectedItems.length > 0) {
      // Get customization item details to populate ingredient and type
      const itemIds = selectedItems.map((item) => item.customization_item_id);
      console.log(
        "[LINK CUSTOMIZATIONS] Fetching details for item IDs:",
        itemIds,
      );

      itemDetails = await sql`
        SELECT id, name, customization_type, default_price, option_group_name
        FROM customization_items
        WHERE id = ANY(${itemIds})
      `;

      console.log(
        "[LINK CUSTOMIZATIONS] Item details fetched:",
        JSON.stringify(itemDetails, null, 2),
      );

      itemDetailsMap = {};
      itemDetails.forEach((item) => {
        itemDetailsMap[item.id] = item;
      });

      // Build values for batch insert
      const values = [];
      const placeholders = [];
      let paramCount = 1;

      selectedItems.forEach((item) => {
        const details = itemDetailsMap[item.customization_item_id];
        if (details) {
          values.push(
            id,
            item.customization_item_id,
            details.name,
            details.customization_type,
            item.price !== undefined ? item.price : details.default_price,
            item.is_active !== undefined ? item.is_active : true,
          );
          placeholders.push(
            `($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`,
          );
        }
      });

      if (values.length > 0) {
        const insertQuery = `INSERT INTO product_customizations 
           (product_id, customization_item_id, ingredient, customization_type, price, is_active)
           VALUES ${placeholders.join(", ")}`;

        await sql(insertQuery, values);
        console.log(
          "[LINK CUSTOMIZATIONS] ✅ Successfully inserted customizations",
        );
      }
    }

    // --- Per-product default options (override) ---
    // We treat the incoming optionDefaults payload as authoritative for this product.
    // If a group is omitted (or set to null), we clear the product override for that group.
    await ensureProductOptionDefaultsTable();

    const defaultsObj =
      optionDefaults && typeof optionDefaults === "object"
        ? optionDefaults
        : {};

    // Clear existing overrides first (simple + avoids edge cases)
    await sql`
      DELETE FROM product_option_defaults
      WHERE product_id = ${id}
    `;

    const optionIdsSet = new Set(
      (itemDetails || [])
        .filter((it) => String(it?.customization_type) === "option")
        .map((it) => Number(it?.id))
        .filter((x) => Number.isFinite(x)),
    );

    const defaultValues = [];
    const defaultPlaceholders = [];
    let dParam = 1;

    Object.entries(defaultsObj).forEach(([groupName, rawId]) => {
      const itemId = Number(rawId);
      if (!Number.isFinite(itemId)) {
        return;
      }

      if (!optionIdsSet.has(itemId)) {
        return;
      }

      const details = itemDetailsMap[itemId];
      if (!details || String(details.customization_type) !== "option") {
        return;
      }

      const groupFromDb =
        details.option_group_name === null ||
        details.option_group_name === undefined ||
        String(details.option_group_name).trim().length === 0
          ? "Options"
          : String(details.option_group_name);

      // We store by group name, not by raw payload key, to avoid mismatches.
      defaultValues.push(id, groupFromDb, itemId);
      defaultPlaceholders.push(`($${dParam++}, $${dParam++}, $${dParam++})`);
    });

    if (defaultValues.length > 0) {
      const insertDefaultsQuery = `
        INSERT INTO product_option_defaults (product_id, option_group_name, customization_item_id)
        VALUES ${defaultPlaceholders.join(", ")}
        ON CONFLICT (product_id, option_group_name)
        DO UPDATE SET
          customization_item_id = EXCLUDED.customization_item_id,
          updated_at = now()
      `;

      await sql(insertDefaultsQuery, defaultValues);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error(
      "[LINK CUSTOMIZATIONS] ❌ Error linking customizations:",
      error,
    );
    console.error("[LINK CUSTOMIZATIONS] Error message:", error.message);
    console.error("[LINK CUSTOMIZATIONS] Error stack:", error.stack);
    return Response.json(
      { error: "Failed to link customizations", details: error.message },
      { status: 500 },
    );
  }
}
