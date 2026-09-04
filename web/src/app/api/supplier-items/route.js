import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

const ALLOWED_UNITS = ['Litre', 'Kg', 'Box', 'Bottle', 'Bag', 'Pcs', 'Gallon'];

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const items = await sql`
      SELECT 
        si.*,
        COALESCE(COUNT(p.id), 0)::integer AS purchase_count,
        COALESCE(SUM(p.qty), 0)::numeric AS total_qty_purchased,
        COALESCE(SUM(p.total_amount), 0)::numeric AS total_spend,
        ROUND(COALESCE(AVG(p.price), 0)::numeric, 2) AS avg_unit_price,
        MAX(p.payment_date) AS last_purchased_date
      FROM supplier_items si
      LEFT JOIN supplier_payments p ON p.item_id = si.id
      GROUP BY si.id
      ORDER BY si.name ASC;
    `;

    return corsJson(request, { ok: true, items, allowedUnits: ALLOWED_UNITS });
  } catch (error) {
    console.error("Error fetching supplier items:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, unit, category, notes } = body;

    if (!name || !name.trim()) {
      return corsJson(request, { ok: false, error: "Item name is required" }, { status: 400 });
    }

    if (!unit || !ALLOWED_UNITS.includes(unit)) {
      return corsJson(request, { 
        ok: false, 
        error: `Invalid unit. Allowed units: ${ALLOWED_UNITS.join(', ')}` 
      }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await sql`
      SELECT id FROM supplier_items WHERE LOWER(name) = LOWER(${trimmedName}) LIMIT 1
    `;
    if (existing.length > 0) {
      return corsJson(request, { ok: false, error: "An item with this name already exists" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO supplier_items (
        name, unit, category, notes, created_at, updated_at
      ) VALUES (
        ${trimmedName}, ${unit}, ${category || null}, ${notes || null}, NOW(), NOW()
      )
      RETURNING *;
    `;

    return corsJson(request, { ok: true, item: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier item:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, unit, category, notes } = body;

    if (!id) {
      return corsJson(request, { ok: false, error: "Item ID is required" }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return corsJson(request, { ok: false, error: "Item name is required" }, { status: 400 });
    }
    if (!unit || !ALLOWED_UNITS.includes(unit)) {
      return corsJson(request, { 
        ok: false, 
        error: `Invalid unit. Allowed units: ${ALLOWED_UNITS.join(', ')}` 
      }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await sql`
      SELECT id FROM supplier_items WHERE LOWER(name) = LOWER(${trimmedName}) AND id != ${id} LIMIT 1
    `;
    if (existing.length > 0) {
      return corsJson(request, { ok: false, error: "Another item already has this name" }, { status: 400 });
    }

    const result = await sql`
      UPDATE supplier_items
      SET 
        name = ${trimmedName},
        unit = ${unit},
        category = ${category || null},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return corsJson(request, { ok: false, error: "Item not found" }, { status: 404 });
    }

    return corsJson(request, { ok: true, item: result[0] });
  } catch (error) {
    console.error("Error updating supplier item:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return corsJson(request, { ok: false, error: "Item ID is required" }, { status: 400 });
    }

    const payments = await sql`
      SELECT id FROM supplier_payments WHERE item_id = ${id} LIMIT 1
    `;
    if (payments.length > 0) {
      return corsJson(request, { 
        ok: false, 
        error: "Cannot delete item because payments reference it. Remove or reassign payments first." 
      }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM supplier_items WHERE id = ${id} RETURNING id;
    `;

    if (result.length === 0) {
      return corsJson(request, { ok: false, error: "Item not found" }, { status: 404 });
    }

    return corsJson(request, { ok: true, deletedId: id });
  } catch (error) {
    console.error("Error deleting supplier item:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}
