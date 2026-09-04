import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const suppliers = await sql`
      SELECT 
        s.*,
        COALESCE(COUNT(p.id), 0)::integer AS total_payments,
        COALESCE(SUM(p.total_amount), 0)::numeric AS total_spend,
        MAX(p.payment_date) AS last_payment_date
      FROM suppliers s
      LEFT JOIN supplier_payments p ON p.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC;
    `;

    return corsJson(request, { ok: true, suppliers });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, contact_person, address, category, notes } = body;

    if (!name || !name.trim()) {
      return corsJson(request, { ok: false, error: "Supplier name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await sql`
      SELECT id FROM suppliers WHERE LOWER(name) = LOWER(${trimmedName}) LIMIT 1
    `;
    if (existing.length > 0) {
      return corsJson(request, { ok: false, error: "A supplier with this name already exists" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO suppliers (
        name, phone, contact_person, address, category, notes, created_at, updated_at
      ) VALUES (
        ${trimmedName}, ${phone || null}, ${contact_person || null},
        ${address || null}, ${category || null}, ${notes || null}, NOW(), NOW()
      )
      RETURNING *;
    `;

    return corsJson(request, { ok: true, supplier: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, phone, contact_person, address, category, notes } = body;

    if (!id) {
      return corsJson(request, { ok: false, error: "Supplier ID is required" }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return corsJson(request, { ok: false, error: "Supplier name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await sql`
      SELECT id FROM suppliers WHERE LOWER(name) = LOWER(${trimmedName}) AND id != ${id} LIMIT 1
    `;
    if (existing.length > 0) {
      return corsJson(request, { ok: false, error: "Another supplier already has this name" }, { status: 400 });
    }

    const result = await sql`
      UPDATE suppliers
      SET 
        name = ${trimmedName},
        phone = ${phone || null},
        contact_person = ${contact_person || null},
        address = ${address || null},
        category = ${category || null},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return corsJson(request, { ok: false, error: "Supplier not found" }, { status: 404 });
    }

    return corsJson(request, { ok: true, supplier: result[0] });
  } catch (error) {
    console.error("Error updating supplier:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return corsJson(request, { ok: false, error: "Supplier ID is required" }, { status: 400 });
    }

    const payments = await sql`
      SELECT id FROM supplier_payments WHERE supplier_id = ${id} LIMIT 1
    `;
    if (payments.length > 0) {
      return corsJson(request, { 
        ok: false, 
        error: "Cannot delete supplier because payments are linked to it. Delete or reassign those payments first." 
      }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM suppliers WHERE id = ${id} RETURNING id;
    `;

    if (result.length === 0) {
      return corsJson(request, { ok: false, error: "Supplier not found" }, { status: 404 });
    }

    return corsJson(request, { ok: true, deletedId: id });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}
