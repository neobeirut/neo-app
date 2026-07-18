import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function OPTIONS(request) {
  return corsOptions(request);
}

async function requireAdmin(request) {
  const admin = await getAdminWithRolesFromRequest(request);
  if (!admin) {
    return null;
  }
  return admin;
}

export async function GET(request, { params }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(params?.id);
    if (!Number.isFinite(id)) {
      return corsJson(
        request,
        { error: "Invalid product id" },
        { status: 400 },
      );
    }

    const [row] = await sql`
      SELECT product_id, mode, recommended_product_ids
      FROM product_recommendations_overrides
      WHERE product_id = ${id}
      LIMIT 1
    `;

    if (!row) {
      return corsJson(request, {
        mode: null, // auto
        recommended_product_ids: [],
      });
    }

    return corsJson(request, {
      mode: row.mode,
      recommended_product_ids: row.recommended_product_ids || [],
    });
  } catch (error) {
    console.error(
      "[api/products/:id/recommendations-override] GET error",
      error,
    );
    return corsJson(
      request,
      { error: "Failed to load recommendations override" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(params?.id);
    if (!Number.isFinite(id)) {
      return corsJson(
        request,
        { error: "Invalid product id" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const modeRaw = body?.mode;

    // Supported:
    // - mode: null | 'auto' => remove override
    // - mode: 'none'
    // - mode: 'manual' + recommended_product_ids
    const mode =
      modeRaw === null || modeRaw === undefined || modeRaw === "auto"
        ? null
        : String(modeRaw);

    if (mode === null) {
      await sql`
        DELETE FROM product_recommendations_overrides
        WHERE product_id = ${id}
      `;

      return corsJson(request, {
        ok: true,
        mode: null,
        recommended_product_ids: [],
      });
    }

    if (mode !== "none" && mode !== "manual") {
      return corsJson(
        request,
        { error: "mode must be one of: auto, none, manual" },
        { status: 400 },
      );
    }

    const idsRaw = Array.isArray(body?.recommended_product_ids)
      ? body.recommended_product_ids
      : [];

    const cleanedIds = Array.from(
      new Set(
        idsRaw
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v) && v > 0 && v !== id),
      ),
    ).slice(0, 12);

    await sql`
      INSERT INTO product_recommendations_overrides (
        product_id,
        mode,
        recommended_product_ids,
        updated_at
      )
      VALUES (
        ${id},
        ${mode},
        ${cleanedIds},
        now()
      )
      ON CONFLICT (product_id)
      DO UPDATE SET
        mode = EXCLUDED.mode,
        recommended_product_ids = EXCLUDED.recommended_product_ids,
        updated_at = now()
    `;

    return corsJson(request, {
      ok: true,
      mode,
      recommended_product_ids: cleanedIds,
    });
  } catch (error) {
    console.error(
      "[api/products/:id/recommendations-override] PUT error",
      error,
    );
    return corsJson(
      request,
      { error: "Failed to save recommendations override" },
      { status: 500 },
    );
  }
}
