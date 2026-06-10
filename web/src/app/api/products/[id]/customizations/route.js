import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// GET - Fetch customizations for a product
export async function GET(request, { params }) {
  try {
    const { id } = params;

    let customizations;

    try {
      // Preferred query: include metadata from customization_items (newer schema)
      // + product-level default overrides for option groups.
      customizations = await sql`
        SELECT 
          pc.*,
          ci.option_group_name,
          ci.is_required,
          ci.is_multi_select,
          ci.display_order,
          ci.is_default,
          CASE
            WHEN pc.customization_type = 'option'
              AND pod.customization_item_id = pc.customization_item_id
            THEN true
            ELSE false
          END AS is_default_for_product
        FROM product_customizations pc
        LEFT JOIN customization_items ci ON pc.customization_item_id = ci.id
        LEFT JOIN product_option_defaults pod
          ON pod.product_id = pc.product_id
          AND pod.option_group_name = ci.option_group_name
        WHERE pc.product_id = ${id}
          AND pc.customization_item_id IS NOT NULL
          AND pc.customization_type <> 'addon'
          AND pc.is_active IS DISTINCT FROM FALSE
          AND ci.is_active IS DISTINCT FROM FALSE
        ORDER BY 
          CASE pc.customization_type 
            WHEN 'option' THEN 1 
            WHEN 'remove' THEN 2 
            ELSE 3
          END,
          ci.display_order,
          pc.ingredient
      `;
    } catch (innerError) {
      // Fallback for older production databases that may not have customization_items columns yet
      // OR if product_option_defaults doesn't exist yet.
      console.error(
        "Error fetching customizations with metadata join (falling back):",
        innerError,
      );

      customizations = await sql`
        SELECT pc.*
        FROM product_customizations pc
        WHERE pc.product_id = ${id}
          AND pc.customization_item_id IS NOT NULL
          AND pc.customization_type <> 'addon'
          AND pc.is_active IS DISTINCT FROM FALSE
        ORDER BY 
          CASE pc.customization_type 
            WHEN 'option' THEN 1 
            WHEN 'remove' THEN 2 
            ELSE 3
          END,
          pc.ingredient
      `;
    }

    return Response.json({ customizations: customizations || [] });
  } catch (error) {
    console.error("Error fetching customizations:", error);
    return Response.json(
      { error: "Failed to fetch customizations" },
      { status: 500 },
    );
  }
}

// POST - Create a new customization (admin only)
export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { ingredient, customization_type, price, is_active } = body;

    if (!ingredient || !customization_type) {
      return Response.json(
        { error: "Ingredient and customization type are required" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO product_customizations (
        product_id, ingredient, customization_type, price, is_active
      )
      VALUES (
        ${id}, 
        ${ingredient}, 
        ${customization_type}, 
        ${price || 0},
        ${is_active !== undefined ? is_active : true}
      )
      RETURNING *
    `;

    return Response.json({ customization: result[0] });
  } catch (error) {
    console.error("Error creating customization:", error);
    return Response.json(
      { error: "Failed to create customization" },
      { status: 500 },
    );
  }
}

// PUT - Update customization
export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      customization_id,
      ingredient,
      customization_type,
      price,
      is_active,
    } = body;

    if (!customization_id) {
      return Response.json(
        { error: "Customization ID is required" },
        { status: 400 },
      );
    }

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    if (ingredient !== undefined) {
      setClauses.push(`ingredient = $${paramCount++}`);
      values.push(ingredient);
    }
    if (customization_type !== undefined) {
      setClauses.push(`customization_type = $${paramCount++}`);
      values.push(customization_type);
    }
    if (price !== undefined) {
      setClauses.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (is_active !== undefined) {
      setClauses.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(customization_id, id);
    const result = await sql(
      `UPDATE product_customizations 
       SET ${setClauses.join(", ")} 
       WHERE id = $${paramCount++} AND product_id = $${paramCount}
       RETURNING *`,
      values,
    );

    if (result.length === 0) {
      return Response.json(
        { error: "Customization not found" },
        { status: 404 },
      );
    }

    return Response.json({ customization: result[0] });
  } catch (error) {
    console.error("Error updating customization:", error);
    return Response.json(
      { error: "Failed to update customization" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a customization
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const customization_id = searchParams.get("customization_id");

    if (!customization_id) {
      return Response.json(
        { error: "Customization ID is required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM product_customizations 
      WHERE id = ${customization_id} AND product_id = ${id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting customization:", error);
    return Response.json(
      { error: "Failed to delete customization" },
      { status: 500 },
    );
  }
}
