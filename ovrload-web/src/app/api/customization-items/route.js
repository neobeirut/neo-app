import sql from "@/app/api/utils/sql";

// GET - Fetch all customization items
export async function GET(request) {
  try {
    const items = await sql`
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
        display_order,
        created_at
      FROM customization_items
      ORDER BY 
        CASE customization_type 
          WHEN 'option' THEN 1 
          WHEN 'addon' THEN 2 
          WHEN 'remove' THEN 3 
        END,
        display_order,
        name
    `;

    return Response.json({ items });
  } catch (error) {
    console.error("Error fetching customization items:", error);
    return Response.json(
      { error: "Failed to fetch customization items" },
      { status: 500 },
    );
  }
}

// POST - Create a new customization item
export async function POST(request) {
  try {
    const {
      name,
      customization_type,
      default_price,
      is_active,
      is_default,
      option_group_name,
      is_required,
      is_multi_select,
      display_order,
    } = await request.json();

    if (!name || !customization_type) {
      return Response.json(
        { error: "Name and customization type are required" },
        { status: 400 },
      );
    }

    if (!["addon", "remove", "option"].includes(customization_type)) {
      return Response.json(
        { error: "Customization type must be 'addon', 'remove', or 'option'" },
        { status: 400 },
      );
    }

    const isOption = customization_type === "option";

    // For options, require group name
    if (isOption && !option_group_name) {
      return Response.json(
        { error: "Option group name is required for options" },
        { status: 400 },
      );
    }

    // Only options can be "default".
    const isDefault = isOption ? !!is_default : false;

    let item;

    if (isOption && isDefault) {
      // Ensure only one default per group.
      const [cleared, inserted] = await sql.transaction((txn) => [
        txn`
          UPDATE customization_items
          SET is_default = false
          WHERE customization_type = 'option'
            AND option_group_name = ${option_group_name}
            AND is_default = true
        `,
        txn`
          INSERT INTO customization_items (
            name,
            customization_type,
            default_price,
            is_active,
            is_default,
            option_group_name,
            is_required,
            is_multi_select,
            display_order
          )
          VALUES (
            ${name},
            ${customization_type},
            ${default_price || 0},
            ${is_active !== false},
            ${true},
            ${option_group_name || null},
            ${is_required || false},
            ${is_multi_select || false},
            ${display_order || 0}
          )
          RETURNING *
        `,
      ]);
      item = inserted?.[0];
    } else {
      const [inserted] = await sql`
        INSERT INTO customization_items (
          name,
          customization_type,
          default_price,
          is_active,
          is_default,
          option_group_name,
          is_required,
          is_multi_select,
          display_order
        )
        VALUES (
          ${name},
          ${customization_type},
          ${default_price || 0},
          ${is_active !== false},
          ${isDefault},
          ${option_group_name || null},
          ${is_required || false},
          ${is_multi_select || false},
          ${display_order || 0}
        )
        RETURNING *
      `;
      item = inserted;
    }

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error creating customization item:", error);
    if (error.message?.includes("duplicate key")) {
      return Response.json(
        { error: "A customization with this name and type already exists" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "Failed to create customization item" },
      { status: 500 },
    );
  }
}

// PUT - Update a customization item
export async function PUT(request) {
  try {
    const {
      id,
      name,
      customization_type,
      default_price,
      is_active,
      is_default,
      option_group_name,
      is_required,
      is_multi_select,
      display_order,
    } = await request.json();

    if (!id) {
      return Response.json(
        { error: "Customization item ID is required" },
        { status: 400 },
      );
    }

    // Load current row so we can safely enforce "one default per group"
    const [current] = await sql`
      SELECT id, customization_type, option_group_name, is_default
      FROM customization_items
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!current) {
      return Response.json(
        { error: "Customization item not found" },
        { status: 404 },
      );
    }

    const nextType =
      customization_type !== undefined && customization_type !== null
        ? String(customization_type)
        : String(current.customization_type);

    const nextGroup =
      option_group_name !== undefined
        ? option_group_name || null
        : current.option_group_name || null;

    const wantsDefault =
      is_default !== undefined ? !!is_default : !!current.is_default;

    const nextIsDefault = nextType === "option" ? wantsDefault : false;

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (customization_type !== undefined) {
      setClauses.push(`customization_type = $${paramCount++}`);
      values.push(customization_type);
    }
    if (default_price !== undefined) {
      setClauses.push(`default_price = $${paramCount++}`);
      values.push(default_price);
    }
    if (is_active !== undefined) {
      setClauses.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (option_group_name !== undefined) {
      setClauses.push(`option_group_name = $${paramCount++}`);
      values.push(option_group_name || null);
    }
    if (is_required !== undefined) {
      setClauses.push(`is_required = $${paramCount++}`);
      values.push(is_required);
    }
    if (is_multi_select !== undefined) {
      setClauses.push(`is_multi_select = $${paramCount++}`);
      values.push(is_multi_select);
    }
    if (display_order !== undefined) {
      setClauses.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }

    // Always normalize is_default if the caller sends it OR if they changed type.
    if (is_default !== undefined || customization_type !== undefined) {
      setClauses.push(`is_default = $${paramCount++}`);
      values.push(nextIsDefault);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    // If setting this option as default, clear other defaults in the group first.
    if (nextType === "option" && nextIsDefault && nextGroup) {
      const [_, updatedRows] = await sql.transaction((txn) => [
        txn`
          UPDATE customization_items
          SET is_default = false
          WHERE customization_type = 'option'
            AND option_group_name = ${nextGroup}
            AND id <> ${id}
            AND is_default = true
        `,
        txn(
          `UPDATE customization_items 
           SET ${setClauses.join(", ")} 
           WHERE id = $${paramCount}
           RETURNING *`,
          [...values, id],
        ),
      ]);

      const item = updatedRows?.[0];

      if (!item) {
        return Response.json(
          { error: "Customization item not found" },
          { status: 404 },
        );
      }

      return Response.json({ item });
    }

    const [item] = await sql(
      `UPDATE customization_items 
       SET ${setClauses.join(", ")} 
       WHERE id = $${paramCount}
       RETURNING *`,
      [...values, id],
    );

    if (!item) {
      return Response.json(
        { error: "Customization item not found" },
        { status: 404 },
      );
    }

    return Response.json({ item });
  } catch (error) {
    console.error("Error updating customization item:", error);
    return Response.json(
      { error: "Failed to update customization item" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a customization item
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Customization item ID is required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM customization_items
      WHERE id = ${id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting customization item:", error);
    return Response.json(
      { error: "Failed to delete customization item" },
      { status: 500 },
    );
  }
}
