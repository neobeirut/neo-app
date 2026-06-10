import sql from "@/app/api/utils/sql";

function applyInventoryStatusRule(
  currentStatus,
  inventoryApplies,
  quantityOnHand,
) {
  if (!inventoryApplies) {
    return currentStatus;
  }

  const qty =
    quantityOnHand === null || quantityOnHand === undefined
      ? 0
      : quantityOnHand;

  if (
    currentStatus === "Hide from Menu" ||
    currentStatus === "Unavailable Until Further Notice"
  ) {
    return currentStatus;
  }

  if (qty <= 0) {
    return "Unavailable Today";
  }

  if (currentStatus === "Unavailable Today") {
    return "Available";
  }

  return currentStatus;
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const branch_id = searchParams.get("branch_id");

    let query = `
      SELECT 
        p.*, 
        c.name as category_name,
        COALESCE(pbs.status, p.status) as effective_status,
        COALESCE(pbs.price, p.price) as effective_price,
        p.price as base_price,
        pbs.price as branch_price,
        pbs.quantity_on_hand
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `;

    // Join with product_branch_status if branch_id is provided
    if (branch_id) {
      query += ` LEFT JOIN product_branch_status pbs ON p.id = pbs.product_id AND pbs.branch_id = $1`;
    } else {
      query += ` LEFT JOIN product_branch_status pbs ON FALSE`;
    }

    query += ` WHERE p.id = $${branch_id ? "2" : "1"}`;

    const values = branch_id ? [branch_id, id] : [id];

    const [product] = await sql(query, values);

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const computedStatus = applyInventoryStatusRule(
      product.effective_status,
      !!product.inventory_applies,
      product.quantity_on_hand,
    );

    // Use the effective status for consistent API response
    const processedProduct = {
      ...product,
      status: computedStatus,
      price: product.effective_price,
      effective_status: undefined,
      effective_price: undefined,
    };

    // Get add-ons for this product
    const addons = await sql`
      SELECT * FROM product_addons 
      WHERE product_id = ${id} AND is_active = true
      ORDER BY name
    `;

    return Response.json({
      product: { ...processedProduct, addons },
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return Response.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const {
      name,
      description,
      price,
      original_price,
      image_url,
      category_id,
      prep_time,
      ingredients,
      nutritional_info,
      is_featured,
      is_special,
      status,
      inventory_applies,
    } = await request.json();

    const [product] = await sql`
      UPDATE products 
      SET name = ${name}, 
          description = ${description}, 
          price = ${price}, 
          original_price = ${original_price}, 
          image_url = ${image_url}, 
          category_id = ${category_id},
          prep_time = ${prep_time},
          ingredients = ${ingredients},
          nutritional_info = ${nutritional_info},
          is_featured = ${is_featured},
          is_special = ${is_special},
          status = ${status || "Available"},
          inventory_applies = ${inventory_applies ?? false}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    return Response.json(
      { error: "Failed to update product" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const { status, updateAllBranches } = await request.json();

    if (!status) {
      return Response.json({ error: "Status is required" }, { status: 400 });
    }

    // Update the main product status
    const [product] = await sql`
      UPDATE products 
      SET status = ${status}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    // If updateAllBranches is true, remove all branch-specific status overrides
    // This ensures all branches use the main product status
    if (updateAllBranches) {
      await sql`
        DELETE FROM product_branch_status
        WHERE product_id = ${id}
      `;
    }

    return Response.json({
      product,
      message: updateAllBranches
        ? "Status updated for all branches"
        : "Product status updated",
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    return Response.json(
      { error: "Failed to update product status" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Actually delete the product from the database
    const [product] = await sql`
      DELETE FROM products 
      WHERE id = ${id}
      RETURNING *
    `;

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return Response.json(
      { error: "Failed to delete product" },
      { status: 500 },
    );
  }
}
