import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

function parseNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function parseIsoDateOrNull(value) {
  if (!value) {
    return null;
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const rows = await sql`
      SELECT *
      FROM promo_codes
      ORDER BY created_at DESC
      LIMIT 500
    `;

    return Response.json({ promoCodes: rows });
  } catch (e) {
    console.error("[promo-codes/admin] GET error", e);
    return Response.json(
      { error: "Failed to fetch promo codes" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const code = normalizeCode(body?.code);
    const description = body?.description ? String(body.description) : null;

    const discountType = String(body?.discount_type || body?.discountType || "")
      .trim()
      .toLowerCase();

    const discountValue = parseNumberOrNull(
      body?.discount_value ?? body?.discountValue,
    );

    if (!code) {
      return Response.json({ error: "Code is required" }, { status: 400 });
    }

    if (discountType !== "percent" && discountType !== "fixed") {
      return Response.json(
        { error: "discount_type must be 'percent' or 'fixed'" },
        { status: 400 },
      );
    }

    if (discountValue === null || discountValue <= 0) {
      return Response.json(
        { error: "discount_value must be a positive number" },
        { status: 400 },
      );
    }

    if (discountType === "percent" && discountValue > 100) {
      return Response.json(
        { error: "Percent discounts cannot be over 100" },
        { status: 400 },
      );
    }

    const minSubtotal = parseNumberOrNull(
      body?.min_subtotal ?? body?.minSubtotal,
    );
    const maxDiscount = parseNumberOrNull(
      body?.max_discount ?? body?.maxDiscount,
    );

    const startAt = parseIsoDateOrNull(body?.start_at ?? body?.startAt);
    const endAt = parseIsoDateOrNull(body?.end_at ?? body?.endAt);

    const isActive = body?.is_active ?? body?.isActive;
    const usageLimitTotal = parseIntOrNull(
      body?.usage_limit_total ?? body?.usageLimitTotal,
    );
    const usageLimitPerUser = parseIntOrNull(
      body?.usage_limit_per_user ?? body?.usageLimitPerUser,
    );

    const firstOrderOnly = !!(body?.first_order_only ?? body?.firstOrderOnly);
    const stackable = !!body?.stackable;

    const allowedBranches =
      body?.allowed_branches ?? body?.allowedBranches ?? null;
    const allowedProductIds =
      body?.allowed_product_ids ?? body?.allowedProductIds ?? null;
    const excludedProductIds =
      body?.excluded_product_ids ?? body?.excludedProductIds ?? null;

    const [row] = await sql`
      INSERT INTO promo_codes (
        code,
        description,
        discount_type,
        discount_value,
        min_subtotal,
        max_discount,
        start_at,
        end_at,
        is_active,
        usage_limit_total,
        usage_limit_per_user,
        first_order_only,
        allowed_branches,
        allowed_product_ids,
        excluded_product_ids,
        stackable,
        created_by
      )
      VALUES (
        ${code},
        ${description},
        ${discountType}::promo_discount_type,
        ${discountValue},
        ${minSubtotal},
        ${maxDiscount},
        ${startAt}::timestamptz,
        ${endAt}::timestamptz,
        ${typeof isActive === "boolean" ? isActive : true},
        ${usageLimitTotal},
        ${usageLimitPerUser},
        ${firstOrderOnly},
        ${allowedBranches ? JSON.stringify(allowedBranches) : null}::jsonb,
        ${allowedProductIds ? JSON.stringify(allowedProductIds) : null}::jsonb,
        ${excludedProductIds ? JSON.stringify(excludedProductIds) : null}::jsonb,
        ${stackable},
        ${admin?.email || null}
      )
      RETURNING *
    `;

    return Response.json({ promoCode: row }, { status: 201 });
  } catch (e) {
    console.error("[promo-codes/admin] POST error", e);

    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("duplicate")) {
      return Response.json(
        { error: "A promo code with that code already exists" },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Failed to create promo code" },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const id = body?.id ? String(body.id) : null;
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const setParts = [];
    const values = [];
    let idx = 1;

    if (body?.code !== undefined) {
      const code = normalizeCode(body.code);
      if (!code) {
        return Response.json(
          { error: "code cannot be empty" },
          { status: 400 },
        );
      }
      setParts.push(`code = $${idx}`);
      values.push(code);
      idx++;
    }

    if (body?.description !== undefined) {
      setParts.push(`description = $${idx}`);
      values.push(body.description ? String(body.description) : null);
      idx++;
    }

    if (body?.discount_type !== undefined || body?.discountType !== undefined) {
      const discountType = String(body?.discount_type ?? body?.discountType)
        .trim()
        .toLowerCase();

      if (discountType !== "percent" && discountType !== "fixed") {
        return Response.json(
          { error: "discount_type must be 'percent' or 'fixed'" },
          { status: 400 },
        );
      }

      setParts.push(`discount_type = $${idx}::promo_discount_type`);
      values.push(discountType);
      idx++;
    }

    if (
      body?.discount_value !== undefined ||
      body?.discountValue !== undefined
    ) {
      const discountValue = parseNumberOrNull(
        body?.discount_value ?? body?.discountValue,
      );

      if (discountValue === null || discountValue <= 0) {
        return Response.json(
          { error: "discount_value must be a positive number" },
          { status: 400 },
        );
      }

      setParts.push(`discount_value = $${idx}`);
      values.push(discountValue);
      idx++;
    }

    if (body?.min_subtotal !== undefined || body?.minSubtotal !== undefined) {
      setParts.push(`min_subtotal = $${idx}`);
      values.push(parseNumberOrNull(body?.min_subtotal ?? body?.minSubtotal));
      idx++;
    }

    if (body?.max_discount !== undefined || body?.maxDiscount !== undefined) {
      setParts.push(`max_discount = $${idx}`);
      values.push(parseNumberOrNull(body?.max_discount ?? body?.maxDiscount));
      idx++;
    }

    if (body?.start_at !== undefined || body?.startAt !== undefined) {
      setParts.push(`start_at = $${idx}::timestamptz`);
      values.push(parseIsoDateOrNull(body?.start_at ?? body?.startAt));
      idx++;
    }

    if (body?.end_at !== undefined || body?.endAt !== undefined) {
      setParts.push(`end_at = $${idx}::timestamptz`);
      values.push(parseIsoDateOrNull(body?.end_at ?? body?.endAt));
      idx++;
    }

    if (body?.is_active !== undefined || body?.isActive !== undefined) {
      setParts.push(`is_active = $${idx}`);
      values.push(!!(body?.is_active ?? body?.isActive));
      idx++;
    }

    if (
      body?.usage_limit_total !== undefined ||
      body?.usageLimitTotal !== undefined
    ) {
      setParts.push(`usage_limit_total = $${idx}`);
      values.push(
        parseIntOrNull(body?.usage_limit_total ?? body?.usageLimitTotal),
      );
      idx++;
    }

    if (
      body?.usage_limit_per_user !== undefined ||
      body?.usageLimitPerUser !== undefined
    ) {
      setParts.push(`usage_limit_per_user = $${idx}`);
      values.push(
        parseIntOrNull(body?.usage_limit_per_user ?? body?.usageLimitPerUser),
      );
      idx++;
    }

    if (
      body?.first_order_only !== undefined ||
      body?.firstOrderOnly !== undefined
    ) {
      setParts.push(`first_order_only = $${idx}`);
      values.push(!!(body?.first_order_only ?? body?.firstOrderOnly));
      idx++;
    }

    if (body?.stackable !== undefined) {
      setParts.push(`stackable = $${idx}`);
      values.push(!!body.stackable);
      idx++;
    }

    if (
      body?.allowed_branches !== undefined ||
      body?.allowedBranches !== undefined
    ) {
      setParts.push(`allowed_branches = $${idx}::jsonb`);
      const val = body?.allowed_branches ?? body?.allowedBranches;
      values.push(val ? JSON.stringify(val) : null);
      idx++;
    }

    if (
      body?.allowed_product_ids !== undefined ||
      body?.allowedProductIds !== undefined
    ) {
      setParts.push(`allowed_product_ids = $${idx}::jsonb`);
      const val = body?.allowed_product_ids ?? body?.allowedProductIds;
      values.push(val ? JSON.stringify(val) : null);
      idx++;
    }

    if (
      body?.excluded_product_ids !== undefined ||
      body?.excludedProductIds !== undefined
    ) {
      setParts.push(`excluded_product_ids = $${idx}::jsonb`);
      const val = body?.excluded_product_ids ?? body?.excludedProductIds;
      values.push(val ? JSON.stringify(val) : null);
      idx++;
    }

    if (setParts.length === 0) {
      return Response.json(
        { error: "No fields provided to update" },
        { status: 400 },
      );
    }

    values.push(id);
    const idParam = `$${idx}`;

    const query = `
      UPDATE promo_codes
      SET ${setParts.join(", ")}
      WHERE id = ${idParam}
      RETURNING *
    `;

    const rows = await sql(query, values);
    const updated = rows?.[0] || null;

    if (!updated) {
      return Response.json({ error: "Promo code not found" }, { status: 404 });
    }

    return Response.json({ promoCode: updated });
  } catch (e) {
    console.error("[promo-codes/admin] PATCH error", e);

    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("duplicate")) {
      return Response.json(
        { error: "A promo code with that code already exists" },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Failed to update promo code" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const idFromQuery = searchParams.get("id");

    let id = idFromQuery ? String(idFromQuery) : null;

    if (!id) {
      // allow JSON body too
      const body = await request.json().catch(() => null);
      if (body?.id) {
        id = String(body.id);
      }
    }

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const rows =
      await sql`DELETE FROM promo_codes WHERE id = ${id} RETURNING id`;

    if (!rows?.[0]) {
      return Response.json({ error: "Promo code not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[promo-codes/admin] DELETE error", e);
    return Response.json(
      { error: "Failed to delete promo code" },
      { status: 500 },
    );
  }
}
