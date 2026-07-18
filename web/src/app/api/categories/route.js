import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Admin can ask to include inactive categories
    const include_inactive = searchParams.get("include_inactive") === "true";

    // Mobile can ask for branch-specific category visibility
    const branch_id = searchParams.get("branch_id");

    let categories;

    if (branch_id) {
      // For a given branch, hide categories that have ZERO visible products.
      // A product is considered “hidden” for a branch when its effective status is "Hide from Menu".
      // Anything else (Available, Unavailable Today, Unavailable Until Further Notice, etc.) keeps the category visible.
      const values = [branch_id];
      let paramCount = 1;

      let whereClause = "WHERE 1=1";
      if (!include_inactive) {
        whereClause += " AND c.is_active = true";
      }

      const query = `
        SELECT
          c.*,
          COUNT(p.id) FILTER (
            WHERE COALESCE(pbs.status, p.status) IS NULL
              OR COALESCE(pbs.status, p.status) <> 'Hide from Menu'
          ) AS visible_product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        LEFT JOIN product_branch_status pbs
          ON pbs.product_id = p.id
          AND pbs.branch_id = $${paramCount}
        ${whereClause}
        GROUP BY c.id
        HAVING COUNT(p.id) FILTER (
          WHERE COALESCE(pbs.status, p.status) IS NULL
            OR COALESCE(pbs.status, p.status) <> 'Hide from Menu'
        ) > 0
        ORDER BY c.section, c.display_order, c.name
      `;

      categories = await sql(query, values);
    } else {
      // Default behavior (used by customers): only active categories
      if (include_inactive) {
        categories = await sql`
          SELECT * FROM categories
          ORDER BY section, display_order, name
        `;
      } else {
        categories = await sql`
          SELECT * FROM categories
          WHERE is_active = true
          ORDER BY section, display_order, name
        `;
      }
    }

    // Group categories by section
    const groupedCategories = (categories || []).reduce((acc, category) => {
      const section = category.section || "Store";
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(category);
      return acc;
    }, {});

    return corsJson(request, {
      categories,
      groupedCategories,
      sections: ["Store", "Bistro"],
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return corsJson(
      request,
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { name, image_url, display_order, section } = body || {};

    if (!name || !String(name).trim()) {
      return corsJson(
        request,
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    const [category] = await sql`
      INSERT INTO categories (name, image_url, display_order, section)
      VALUES (
        ${String(name).trim()},
        ${image_url || null},
        ${display_order ?? 0},
        ${section || "Store"}
      )
      RETURNING *
    `;

    return corsJson(request, { category });
  } catch (error) {
    console.error("Error creating category:", error);
    return corsJson(
      request,
      { error: `Failed to create category: ${error.message}` },
      { status: 500 },
    );
  }
}
