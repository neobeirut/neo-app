import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    console.log("=== GET /api/products called ===");
    const { searchParams } = new URL(request.url);
    const category_id = searchParams.get("category_id");
    const is_featured = searchParams.get("is_featured");
    const is_special = searchParams.get("is_special");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const available_only = searchParams.get("available_only");
    const branch_id = searchParams.get("branch_id");

    console.log("Search params:", {
      category_id,
      is_featured,
      is_special,
      search,
      status,
      available_only,
      branch_id,
    });

    // Build query differently based on whether we're filtering by branch
    let query;
    const values = [];
    let paramCount = 0;

    if (branch_id) {
      // When filtering by branch, include product_branch_status
      query = `
        SELECT p.*, c.name as category_name,
               COALESCE(pbs.status, p.status) as effective_status,
               COALESCE(pbs.price, p.price) as price,
               pbs.quantity_on_hand,
               EXISTS(SELECT 1 FROM product_customizations WHERE product_id = p.id AND is_active = true) as has_customizations
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_branch_status pbs ON p.id = pbs.product_id AND pbs.branch_id = $1
        WHERE 1=1
      `;
      values.push(branch_id);
      paramCount = 1;
    } else {
      // When not filtering by branch, just use product status
      query = `
        SELECT p.*, c.name as category_name,
               p.status as effective_status,
               p.price as price,
               NULL::integer as quantity_on_hand,
               EXISTS(SELECT 1 FROM product_customizations WHERE product_id = p.id AND is_active = true) as has_customizations
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
      `;
    }

    if (available_only === "true") {
      query += ` AND p.status = 'Available'`;
    }

    if (status) {
      paramCount++;
      query += ` AND p.status = $${paramCount}`;
      values.push(status);
    }

    if (category_id) {
      paramCount++;
      query += ` AND p.category_id = $${paramCount}`;
      values.push(category_id);
    }

    if (is_featured === "true") {
      query += ` AND p.is_featured = true`;
    }

    if (is_special === "true") {
      query += ` AND p.is_special = true`;
    }

    if (search) {
      paramCount++;
      query += ` AND (LOWER(p.name) LIKE LOWER($${paramCount}) OR LOWER(p.description) LIKE LOWER($${paramCount}))`;
      values.push(`%${search}%`);
    }

    query += ` ORDER BY p.sort_order, p.name`;

    const products = await sql(query, values);

    // Map effective_status back to status for consistent API response
    const processedProducts = products.map((product) => {
      const { effective_status, ...rest } = product;
      return {
        ...rest,
        status: effective_status,
      };
    });

    return corsJson(request, { products: processedProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    return corsJson(
      request,
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    console.log("[API POST /api/products] Starting product creation");

    const body = await request.json();

    // Defensive: ignore any id coming from the client (new products should always be server-generated)
    const {
      id: _ignoredId,
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
    } = body;

    // Validate required fields
    if (!name || !price) {
      return corsJson(
        request,
        { error: "Name and price are required" },
        { status: 400 },
      );
    }

    // Validate price is a positive number
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return corsJson(
        request,
        { error: "Price must be a positive number" },
        { status: 400 },
      );
    }

    const originalPriceNum =
      original_price === null ||
      original_price === undefined ||
      original_price === ""
        ? null
        : parseFloat(original_price);

    if (
      originalPriceNum !== null &&
      (isNaN(originalPriceNum) || originalPriceNum <= 0)
    ) {
      return corsJson(
        request,
        { error: "Original price must be a positive number" },
        { status: 400 },
      );
    }

    // Get the max sort_order for this category and add 1
    const maxSortOrder = await sql`
      SELECT COALESCE(MAX(sort_order), -1) as max_order
      FROM products
      WHERE category_id = ${category_id || null}
    `;

    const newSortOrder = (maxSortOrder[0]?.max_order || -1) + 1;

    // NOTE:
    // Do NOT hardcode a sequence name here. Some deployments may have a different underlying
    // sequence name for `products.id` (identity/serial recreation). Let Postgres apply the
    // column default so inserts work across environments.
    const [product] = await sql`
      INSERT INTO products (
        name, description, price, original_price, image_url, category_id,
        prep_time, ingredients, nutritional_info,
        is_featured, is_special, status, sort_order,
        inventory_applies
      )
      VALUES (
        ${name}, 
        ${description || null}, 
        ${priceNum}, 
        ${originalPriceNum}, 
        ${image_url || null}, 
        ${category_id || null},
        ${prep_time || null}, 
        ${ingredients || null}, 
        ${nutritional_info || null},
        ${!!is_featured}, 
        ${!!is_special},
        ${status || "Available"},
        ${newSortOrder},
        ${!!inventory_applies}
      )
      RETURNING *
    `;

    return corsJson(
      request,
      {
        product,
        message: "Product created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API POST /api/products] ❌ Error creating product:", error);
    return corsJson(
      request,
      { error: `Failed to create product: ${error.message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    await sql`DELETE FROM products`;

    return corsJson(request, {
      success: true,
      message: "All products deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting all products:", error);
    return corsJson(
      request,
      { error: "Failed to delete products" },
      { status: 500 },
    );
  }
}
