import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^0-9]/g, "");
  return cleaned || null;
}

function getHeaderUserId(request) {
  const raw =
    request.headers.get("x-auth-user-id") ||
    request.headers.get("X-Auth-User-Id") ||
    request.headers.get("X-AUTH-USER-ID");

  if (!raw) return null;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

async function tryGetJwtUserId(request) {
  let getToken;
  try {
    ({ getToken } = await import("@auth/core/jwt"));
  } catch (e) {
    return null;
  }

  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: String(process.env.AUTH_URL || "").startsWith("https"),
    });

    if (jwt?.sub) {
      return Number(jwt.sub);
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveUserIdFromHeader(request, phone) {
  const headerUserId = getHeaderUserId(request);
  if (!headerUserId) return null;

  if (phone) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    // Older users may have NULL phone. In that case we can't validate; accept header id.
    if (!dbPhone) {
      return Number(rows[0].id);
    }

    if (dbPhone !== phone) {
      return null;
    }

    return Number(rows[0].id);
  }

  const rows =
    await sql`SELECT id FROM auth_users WHERE id = ${headerUserId} AND is_active = true`;
  if (rows.length === 0) return null;
  return Number(rows[0].id);
}

async function resolveUserId(request, bodyPhone) {
  const { searchParams } = new URL(request.url);

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone =
    normalizePhone(bodyPhone) ||
    normalizePhone(searchParams.get("phone")) ||
    normalizePhone(headerPhoneRaw);

  const headerResolved = await resolveUserIdFromHeader(request, phone);
  if (headerResolved) return headerResolved;

  if (phone) {
    const rows = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phone],
    );
    if (rows.length > 0) return Number(rows[0].id);
  }

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) return jwtUserId;

  return null;
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

function coerceJsonArray(val) {
  if (!val) return null;

  // Postgres jsonb usually comes through as an object/array already, but be defensive.
  if (Array.isArray(val)) {
    return val;
  }

  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function coerceIdSet(list) {
  const arr = coerceJsonArray(list);
  if (!arr) return null;

  const set = new Set();
  for (const x of arr) {
    const asNum = Number(x);
    if (Number.isFinite(asNum)) {
      set.add(String(Math.trunc(asNum)));
    } else if (x !== null && x !== undefined && String(x).trim()) {
      set.add(String(x).trim());
    }
  }

  return set.size > 0 ? set : null;
}

function calcDiscount({ promo, eligibleSubtotal }) {
  const type = String(promo?.discount_type || "");
  const discountValue = Number(promo?.discount_value || 0);
  const maxDiscountRaw = promo?.max_discount;
  const maxDiscount =
    maxDiscountRaw === null || maxDiscountRaw === undefined
      ? null
      : Number(maxDiscountRaw);

  if (eligibleSubtotal <= 0) {
    return 0;
  }

  let discount = 0;

  if (type === "percent") {
    discount = (eligibleSubtotal * discountValue) / 100;
  } else if (type === "fixed") {
    discount = discountValue;
  } else {
    discount = 0;
  }

  if (!Number.isFinite(discount) || discount <= 0) {
    return 0;
  }

  // Never exceed eligible subtotal
  discount = Math.min(discount, eligibleSubtotal);

  if (
    maxDiscount !== null &&
    Number.isFinite(maxDiscount) &&
    maxDiscount >= 0
  ) {
    discount = Math.min(discount, maxDiscount);
  }

  // round to cents (return numeric-friendly)
  return Math.round(discount * 100) / 100;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const branchIdRaw = body?.branch_id ?? body?.branchId;
    const branchId = branchIdRaw ? Number(branchIdRaw) : null;

    const codeRaw = body?.code ?? body?.promo_code ?? body?.promoCode;
    const code = normalizeCode(codeRaw);

    if (!branchId || !Number.isFinite(branchId)) {
      return corsJson(
        request,
        { error: "branch_id is required" },
        { status: 400 },
      );
    }

    if (!code) {
      return corsJson(
        request,
        { error: "Promo code is required" },
        { status: 400 },
      );
    }

    const userId = await resolveUserId(request, body?.phone);
    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Pull the cart for this branch so validation is based on server truth.
    const cartItems = await sql(
      `
      SELECT
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.customizations,
        COALESCE(pbs.price, p.price) as price,
        COALESCE(
          array_agg(DISTINCT cia.product_addon_id ORDER BY cia.product_addon_id)
          FILTER (WHERE cia.product_addon_id IS NOT NULL),
          '{}'::int[]
        ) as addon_ids
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_branch_status pbs
        ON p.id = pbs.product_id AND pbs.branch_id = $1
      LEFT JOIN cart_item_addons cia ON ci.id = cia.cart_item_id
      WHERE ci.user_id = $2 AND ci.branch_id = $1
      GROUP BY ci.id, ci.product_id, ci.quantity, ci.customizations, COALESCE(pbs.price, p.price)
      `,
      [branchId, userId],
    );

    if (!cartItems || cartItems.length === 0) {
      return corsJson(
        request,
        { error: "Your cart is empty" },
        { status: 400 },
      );
    }

    const productIds = cartItems
      .map((x) => Number(x.product_id))
      .filter((x) => Number.isFinite(x));

    // Compute subtotal exactly like checkout UI: (base + addonPrices + customizationAddonPrices) * qty
    let subtotal = 0;
    for (const item of cartItems) {
      const qty = Number(item.quantity || 0);
      if (!Number.isFinite(qty) || qty < 1) continue;

      const basePrice = Number(item.price || 0);
      const addonIds = Array.isArray(item.addon_ids)
        ? item.addon_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))
        : [];

      let addonsSum = 0;
      if (addonIds.length > 0) {
        const addonRows =
          await sql`SELECT price FROM product_addons WHERE id = ANY(${addonIds})`;
        addonsSum = (addonRows || []).reduce(
          (sum, a) => sum + (Number(a.price || 0) || 0),
          0,
        );
      }

      const customizations = Array.isArray(item.customizations)
        ? item.customizations
        : [];

      const customizationsAddonSum = customizations.reduce((sum, c) => {
        const type = c?.customization_type || c?.type;
        if (String(type) !== "addon") return sum;
        const price = Number(c?.price || 0);
        return sum + (Number.isFinite(price) ? price : 0);
      }, 0);

      const line =
        (Number(basePrice || 0) + addonsSum + customizationsAddonSum) * qty;
      subtotal += Number.isFinite(line) ? line : 0;
    }

    subtotal = Math.round(subtotal * 100) / 100;

    const now = new Date();

    const promoRows = await sql(
      `
      SELECT *
      FROM promo_codes
      WHERE upper(trim(code)) = upper(trim($1))
      LIMIT 1
      `,
      [code],
    );

    const promo = promoRows?.[0] || null;
    if (!promo) {
      return corsJson(
        request,
        { error: "Promo code not found" },
        { status: 404 },
      );
    }

    if (promo.is_active !== true) {
      return corsJson(
        request,
        { error: "Promo code is not active" },
        { status: 400 },
      );
    }

    if (promo.start_at && new Date(promo.start_at) > now) {
      return corsJson(
        request,
        { error: "Promo code is not active yet" },
        { status: 400 },
      );
    }

    if (promo.end_at && new Date(promo.end_at) < now) {
      return corsJson(
        request,
        { error: "Promo code has expired" },
        { status: 400 },
      );
    }

    const minSubtotal =
      promo.min_subtotal === null || promo.min_subtotal === undefined
        ? null
        : Number(promo.min_subtotal);

    if (minSubtotal !== null && Number.isFinite(minSubtotal)) {
      if (subtotal < minSubtotal) {
        return corsJson(
          request,
          {
            error: `Order subtotal must be at least $${minSubtotal.toFixed(2)}`,
          },
          { status: 400 },
        );
      }
    }

    // Branch restriction (allowed_branches: json array of ids)
    const allowedBranches = coerceIdSet(promo.allowed_branches);
    if (allowedBranches) {
      const branchIdStr = String(Math.trunc(branchId));
      if (
        !allowedBranches.has(branchIdStr) &&
        !allowedBranches.has(String(branchId))
      ) {
        return corsJson(
          request,
          { error: "Promo code is not valid for this branch" },
          { status: 400 },
        );
      }
    }

    // Product allow/exclude
    const allowedProductIds = coerceIdSet(promo.allowed_product_ids);
    const excludedProductIds = coerceIdSet(promo.excluded_product_ids);

    if (excludedProductIds) {
      const hasExcluded = productIds.some((pid) =>
        excludedProductIds.has(String(pid)),
      );
      if (hasExcluded) {
        return corsJson(
          request,
          {
            error: "Promo code is not valid for one or more items in your cart",
          },
          { status: 400 },
        );
      }
    }

    let eligibleSubtotal = subtotal;

    if (allowedProductIds) {
      eligibleSubtotal = 0;
      for (const item of cartItems) {
        const pid = Number(item.product_id);
        if (!Number.isFinite(pid)) continue;
        if (!allowedProductIds.has(String(pid))) continue;

        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(qty) || qty < 1) continue;

        const basePrice = Number(item.price || 0);
        const addonIds = Array.isArray(item.addon_ids)
          ? item.addon_ids
              .map((x) => Number(x))
              .filter((x) => Number.isFinite(x))
          : [];

        let addonsSum = 0;
        if (addonIds.length > 0) {
          const addonRows =
            await sql`SELECT price FROM product_addons WHERE id = ANY(${addonIds})`;
          addonsSum = (addonRows || []).reduce(
            (sum, a) => sum + (Number(a.price || 0) || 0),
            0,
          );
        }

        const customizations = Array.isArray(item.customizations)
          ? item.customizations
          : [];

        const customizationsAddonSum = customizations.reduce((sum, c) => {
          const type = c?.customization_type || c?.type;
          if (String(type) !== "addon") return sum;
          const price = Number(c?.price || 0);
          return sum + (Number.isFinite(price) ? price : 0);
        }, 0);

        const line =
          (Number(basePrice || 0) + addonsSum + customizationsAddonSum) * qty;
        eligibleSubtotal += Number.isFinite(line) ? line : 0;
      }

      eligibleSubtotal = Math.round(eligibleSubtotal * 100) / 100;

      if (eligibleSubtotal <= 0) {
        return corsJson(
          request,
          { error: "Promo code doesn't apply to items in your cart" },
          { status: 400 },
        );
      }
    }

    // First order only
    if (promo.first_order_only === true) {
      const rows = await sql(
        "SELECT id FROM orders WHERE user_id = $1 LIMIT 1",
        [userId],
      );
      if (rows.length > 0) {
        return corsJson(
          request,
          { error: "Promo code is only valid for your first order" },
          { status: 400 },
        );
      }
    }

    // Usage limits
    if (
      promo.usage_limit_total !== null &&
      promo.usage_limit_total !== undefined
    ) {
      const limitTotal = Number(promo.usage_limit_total);
      if (Number.isFinite(limitTotal) && limitTotal >= 0) {
        const [{ cnt }] = await sql(
          "SELECT COUNT(*)::int as cnt FROM promo_redemptions WHERE promo_code_id = $1 AND status = 'used'",
          [promo.id],
        );
        const used = Number(cnt || 0);
        if (used >= limitTotal) {
          return corsJson(
            request,
            { error: "Promo code has reached its usage limit" },
            { status: 400 },
          );
        }
      }
    }

    if (
      promo.usage_limit_per_user !== null &&
      promo.usage_limit_per_user !== undefined
    ) {
      const limitUser = Number(promo.usage_limit_per_user);
      if (Number.isFinite(limitUser) && limitUser >= 0) {
        const [{ cnt }] = await sql(
          "SELECT COUNT(*)::int as cnt FROM promo_redemptions WHERE promo_code_id = $1 AND user_id = $2 AND status = 'used'",
          [promo.id, userId],
        );
        const used = Number(cnt || 0);
        if (used >= limitUser) {
          return corsJson(
            request,
            { error: "Promo code usage limit reached for this account" },
            { status: 400 },
          );
        }
      }
    }

    const discountAmount = calcDiscount({ promo, eligibleSubtotal });

    if (discountAmount <= 0) {
      return corsJson(
        request,
        { error: "Promo code does not apply" },
        { status: 400 },
      );
    }

    return corsJson(request, {
      ok: true,
      code,
      description: promo.description || null,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      subtotal,
      eligible_subtotal: eligibleSubtotal,
      discount_amount: discountAmount,
    });
  } catch (e) {
    console.error("[promo-codes/validate] error", e);
    return corsJson(
      request,
      { error: "Failed to validate promo code" },
      { status: 500 },
    );
  }
}
