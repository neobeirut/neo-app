import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function applyInventoryStatusRule(
  currentStatus,
  inventoryApplies,
  quantityOnHand,
) {
  if (!inventoryApplies) {
    return currentStatus;
  }

  // Treat missing quantity as 0 when inventory applies (safer than overselling)
  const qty =
    quantityOnHand === null || quantityOnHand === undefined
      ? 0
      : quantityOnHand;

  // Preserve “hard” admin statuses
  if (
    currentStatus === "Hide from Menu" ||
    currentStatus === "Unavailable Until Further Notice"
  ) {
    return currentStatus;
  }

  if (qty <= 0) {
    return "Unavailable Today";
  }

  // Auto-recover back to Available if restocked and it was Unavailable Today
  if (currentStatus === "Unavailable Today") {
    return "Available";
  }

  return currentStatus;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get("product_id");
    const branch_id = searchParams.get("branch_id");

    // If branch_id is provided, return all products with their status for that branch
    if (branch_id) {
      const products = await sql`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.inventory_applies,
          COALESCE(pbs.price, p.price) as price,
          p.price as base_price,
          pbs.price as branch_price,
          pbs.quantity_on_hand,
          p.image_url,
          p.category_id,
          COALESCE(pbs.status, p.status) as status,
          pbs.updated_at as status_updated_at
        FROM products p
        LEFT JOIN product_branch_status pbs 
          ON p.id = pbs.product_id AND pbs.branch_id = ${branch_id}
        ORDER BY p.name
      `;

      const withInventoryRules = (products || []).map((p) => {
        const nextStatus = applyInventoryStatusRule(
          p.status || "Available",
          p.inventory_applies,
          p.quantity_on_hand,
        );
        return {
          ...p,
          status: nextStatus,
        };
      });

      return corsJson(request, { products: withInventoryRules });
    }

    // Original logic for listing specific statuses
    let query = `
      SELECT pbs.*, p.name as product_name, b.name as branch_name
      FROM product_branch_status pbs
      JOIN products p ON pbs.product_id = p.id
      JOIN branches b ON pbs.branch_id = b.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (product_id) {
      paramCount++;
      query += ` AND pbs.product_id = $${paramCount}`;
      values.push(product_id);
    }

    query += ` ORDER BY p.name, b.name`;

    const statuses = await sql(query, values);
    return corsJson(request, { statuses });
  } catch (error) {
    console.error("Error fetching product branch statuses:", error);
    return corsJson(
      request,
      { error: "Failed to fetch product branch statuses" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    // Admin-only (controls prices/status per branch)
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return corsJson(
        request,
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    if (!admin.roles || !admin.roles.includes("product_status")) {
      return corsJson(
        request,
        { error: "Unauthorized - product_status permission required" },
        { status: 403 },
      );
    }

    const { product_id, branch_id, status, price, quantity_on_hand } =
      await request.json();

    if (!product_id || !branch_id) {
      return corsJson(
        request,
        { error: "Product ID and Branch ID are required" },
        { status: 400 },
      );
    }

    // Load product inventory flag so we can apply automatic status rules.
    const [product] = await sql`
      SELECT id, inventory_applies, status as product_status
      FROM products
      WHERE id = ${product_id}
    `;

    const inventoryApplies = !!product?.inventory_applies;

    // Determine what quantity we should write (if provided)
    const parsedQty =
      quantity_on_hand === "" || quantity_on_hand === undefined
        ? undefined
        : quantity_on_hand === null
          ? null
          : Number(quantity_on_hand);

    if (
      parsedQty !== undefined &&
      parsedQty !== null &&
      Number.isNaN(parsedQty)
    ) {
      return corsJson(
        request,
        { error: "Quantity on hand must be a number" },
        { status: 400 },
      );
    }

    if (parsedQty !== undefined && parsedQty !== null && parsedQty < 0) {
      return corsJson(
        request,
        { error: "Quantity on hand must be 0 or more" },
        { status: 400 },
      );
    }

    // Read existing row so we can preserve fields when only one is changed
    const [existing] = await sql`
      SELECT status, price, quantity_on_hand
      FROM product_branch_status
      WHERE product_id = ${product_id} AND branch_id = ${branch_id}
    `;

    const currentStatus =
      existing?.status || product?.product_status || "Available";
    const currentPrice = existing?.price ?? null;
    const currentQty = existing?.quantity_on_hand ?? null;

    const nextPrice =
      price !== undefined && price !== null && price !== ""
        ? price
        : price === null
          ? null
          : currentPrice;

    const baseStatus = status || currentStatus;
    const nextQty = parsedQty === undefined ? currentQty : parsedQty;

    // Determine the final status:
    // - If the admin explicitly sent a status, always respect it (manual override wins).
    //   This allows store managers to mark inventory-tracked products as Available
    //   even when qty = 0 (e.g. for end-of-day, or when qty tracking is ignored).
    // - If only quantity_on_hand is being updated (no explicit status sent), apply
    //   the automatic inventory rule to derive the status from the new qty.
    const adminExplicitlySetStatus = status !== undefined && status !== null;

    let nextStatus;
    if (adminExplicitlySetStatus) {
      // Admin deliberately chose this status — honour it directly.
      nextStatus = baseStatus;
    } else {
      // No status provided — only qty changed; let inventory rule derive status.
      nextStatus = applyInventoryStatusRule(baseStatus, inventoryApplies, nextQty);
    }

    const [productBranchStatus] = await sql`
      INSERT INTO product_branch_status (
        product_id,
        branch_id,
        status,
        price,
        quantity_on_hand,
        updated_at
      )
      VALUES (
        ${product_id},
        ${branch_id},
        ${nextStatus},
        ${nextPrice !== undefined && nextPrice !== "" ? nextPrice : null},
        ${nextQty},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (product_id, branch_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        price = EXCLUDED.price,
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return corsJson(request, { productBranchStatus });
  } catch (error) {
    console.error("Error updating product branch status:", error);
    return corsJson(
      request,
      { error: `Failed to update product branch status: ${error.message}` },
      { status: 500 },
    );
  }
}
