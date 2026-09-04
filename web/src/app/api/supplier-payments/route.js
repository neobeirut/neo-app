import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

const ALLOWED_UNITS = ['Litre', 'Kg', 'Box', 'Bottle', 'Bag', 'Pcs', 'Gallon'];

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supplierId = searchParams.get("supplierId");
    const itemId = searchParams.get("itemId");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const values = [];
    let whereConditions = ["1=1"];

    if (startDate) {
      values.push(startDate);
      whereConditions.push(`p.payment_date >= $${values.length}::date`);
    }

    if (endDate) {
      values.push(endDate);
      whereConditions.push(`p.payment_date <= $${values.length}::date`);
    }

    if (supplierId && supplierId !== 'all') {
      values.push(parseInt(supplierId, 10));
      whereConditions.push(`p.supplier_id = $${values.length}`);
    }

    if (itemId && itemId !== 'all') {
      values.push(parseInt(itemId, 10));
      whereConditions.push(`p.item_id = $${values.length}`);
    }

    if (search && search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      whereConditions.push(`(
        LOWER(p.invoice_number) LIKE $${values.length} OR
        LOWER(s.name) LIKE $${values.length} OR
        LOWER(si.name) LIKE $${values.length}
      )`);
    }

    const whereClause = whereConditions.join(" AND ");

    // 1. Total count and sum
    const summaryQuery = `
      SELECT 
        COUNT(p.id)::integer AS total_count,
        COALESCE(SUM(p.total_amount), 0)::numeric AS total_spend
      FROM supplier_payments p
      JOIN suppliers s ON s.id = p.supplier_id
      JOIN supplier_items si ON si.id = p.item_id
      WHERE ${whereClause};
    `;
    const summaryRes = await sql(summaryQuery, values);
    const summary = summaryRes[0] || { total_count: 0, total_spend: 0 };

    // 2. Paginated rows
    values.push(limit);
    const limitParam = values.length;
    values.push(offset);
    const offsetParam = values.length;

    const dataQuery = `
      SELECT 
        p.*,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        si.name AS item_name,
        si.unit AS default_unit
      FROM supplier_payments p
      JOIN suppliers s ON s.id = p.supplier_id
      JOIN supplier_items si ON si.id = p.item_id
      WHERE ${whereClause}
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;
    const payments = await sql(dataQuery, values);

    return corsJson(request, {
      ok: true,
      payments,
      summary: {
        totalCount: summary.total_count,
        totalSpend: Number(summary.total_spend)
      }
    });
  } catch (error) {
    console.error("Error fetching supplier payments:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Support batch or single
    const itemsToInsert = Array.isArray(body.payments) ? body.payments : [body];

    if (itemsToInsert.length === 0) {
      return corsJson(request, { ok: false, error: "No payment items provided" }, { status: 400 });
    }

    const inserted = [];

    for (const item of itemsToInsert) {
      const {
        invoice_number,
        payment_date,
        supplier_id,
        item_id,
        unit,
        qty,
        price,
        payment_method,
        status,
        notes,
        created_by
      } = item;

      if (!supplier_id) {
        return corsJson(request, { ok: false, error: "Supplier is required" }, { status: 400 });
      }
      if (!item_id) {
        return corsJson(request, { ok: false, error: "Item is required" }, { status: 400 });
      }
      if (!qty || Number(qty) <= 0) {
        return corsJson(request, { ok: false, error: "Valid quantity greater than 0 is required" }, { status: 400 });
      }
      if (price === undefined || price === null || Number(price) < 0) {
        return corsJson(request, { ok: false, error: "Valid price is required" }, { status: 400 });
      }

      const numQty = Number(qty);
      const numPrice = Number(price);
      const totalAmount = Math.round(numQty * numPrice * 100) / 100;

      // Verify or fetch unit from item
      let finalUnit = unit;
      if (!finalUnit || !ALLOWED_UNITS.includes(finalUnit)) {
        const itemRes = await sql`SELECT unit FROM supplier_items WHERE id = ${item_id} LIMIT 1`;
        if (itemRes.length > 0) {
          finalUnit = itemRes[0].unit;
        } else {
          finalUnit = 'Pcs';
        }
      }

      const row = await sql`
        INSERT INTO supplier_payments (
          invoice_number, payment_date, supplier_id, item_id,
          unit, qty, price, total_amount, payment_method, status, notes, created_by, created_at, updated_at
        ) VALUES (
          ${invoice_number ? String(invoice_number).trim() : null},
          ${payment_date ? payment_date : new Date().toISOString().split('T')[0]},
          ${Number(supplier_id)},
          ${Number(item_id)},
          ${finalUnit},
          ${numQty},
          ${numPrice},
          ${totalAmount},
          ${payment_method || 'Cash'},
          ${status || 'paid'},
          ${notes || null},
          ${created_by || null},
          NOW(),
          NOW()
        )
        RETURNING *;
      `;

      inserted.push(row[0]);
    }

    return corsJson(request, { 
      ok: true, 
      payments: inserted,
      message: `Successfully recorded ${inserted.length} payment record(s)`
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier payment:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      invoice_number,
      payment_date,
      supplier_id,
      item_id,
      unit,
      qty,
      price,
      payment_method,
      status,
      notes
    } = body;

    if (!id) {
      return corsJson(request, { ok: false, error: "Payment ID is required" }, { status: 400 });
    }
    if (!supplier_id || !item_id) {
      return corsJson(request, { ok: false, error: "Supplier and Item are required" }, { status: 400 });
    }
    if (!qty || Number(qty) <= 0) {
      return corsJson(request, { ok: false, error: "Valid quantity greater than 0 is required" }, { status: 400 });
    }
    if (price === undefined || price === null || Number(price) < 0) {
      return corsJson(request, { ok: false, error: "Valid price is required" }, { status: 400 });
    }

    const numQty = Number(qty);
    const numPrice = Number(price);
    const totalAmount = Math.round(numQty * numPrice * 100) / 100;

    const result = await sql`
      UPDATE supplier_payments
      SET
        invoice_number = ${invoice_number ? String(invoice_number).trim() : null},
        payment_date = ${payment_date},
        supplier_id = ${Number(supplier_id)},
        item_id = ${Number(item_id)},
        unit = ${unit},
        qty = ${numQty},
        price = ${numPrice},
        total_amount = ${totalAmount},
        payment_method = ${payment_method || 'Cash'},
        status = ${status || 'paid'},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return corsJson(request, { ok: false, error: "Payment not found" }, { status: 404 });
    }

    return corsJson(request, { ok: true, payment: result[0] });
  } catch (error) {
    console.error("Error updating supplier payment:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return corsJson(request, { ok: false, error: "Payment ID is required" }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM supplier_payments WHERE id = ${id} RETURNING id;
    `;

    if (result.length === 0) {
      return corsJson(request, { ok: false, error: "Payment not found" }, { status: 404 });
    }

    return corsJson(request, { ok: true, deletedId: id });
  } catch (error) {
    console.error("Error deleting supplier payment:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}
