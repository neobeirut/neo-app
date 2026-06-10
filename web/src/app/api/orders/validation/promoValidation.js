import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";
import {
  normalizePromoCode,
  coerceIdSet,
  calcPromoDiscount,
} from "../utils/promoHelpers";

export async function validateAndApplyPromoCode({
  request,
  promo_code,
  userId,
  branch_id,
  subtotalAmount,
  orderItems,
}) {
  const promoCodeNorm = normalizePromoCode(promo_code);

  if (!promoCodeNorm) {
    return { ok: true, promoDiscount: 0, promoCodeId: null };
  }

  const now = new Date();

  const promoRows = await sql(
    `
    SELECT *
    FROM promo_codes
    WHERE upper(trim(code)) = upper(trim($1))
    LIMIT 1
    `,
    [promoCodeNorm],
  );

  const promo = promoRows?.[0] || null;

  if (!promo) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Promo code not found", code: "PROMO_NOT_FOUND" },
        { status: 404 },
      ),
    };
  }

  if (promo.is_active !== true) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Promo code is not active", code: "PROMO_NOT_ACTIVE" },
        { status: 400 },
      ),
    };
  }

  if (promo.start_at && new Date(promo.start_at) > now) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Promo code is not active yet",
          code: "PROMO_NOT_ACTIVE_YET",
        },
        { status: 400 },
      ),
    };
  }

  if (promo.end_at && new Date(promo.end_at) < now) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Promo code has expired", code: "PROMO_EXPIRED" },
        { status: 400 },
      ),
    };
  }

  const minSubtotal =
    promo.min_subtotal === null || promo.min_subtotal === undefined
      ? null
      : Number(promo.min_subtotal);

  if (minSubtotal !== null && Number.isFinite(minSubtotal)) {
    if (subtotalAmount < minSubtotal) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: `Order subtotal must be at least $${minSubtotal.toFixed(2)}`,
            code: "PROMO_MIN_SUBTOTAL",
          },
          { status: 400 },
        ),
      };
    }
  }

  // Branch restriction
  const allowedBranches = coerceIdSet(promo.allowed_branches);
  if (allowedBranches) {
    const branchIdStr = String(Math.trunc(branch_id));
    if (
      !allowedBranches.has(branchIdStr) &&
      !allowedBranches.has(String(branch_id))
    ) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: "Promo code is not valid for this branch",
            code: "PROMO_BRANCH_NOT_ALLOWED",
          },
          { status: 400 },
        ),
      };
    }
  }

  const excludedProductIds = coerceIdSet(promo.excluded_product_ids);
  if (excludedProductIds) {
    const hasExcluded = orderItems.some((it) =>
      excludedProductIds.has(String(it.product_id)),
    );
    if (hasExcluded) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error:
              "Promo code is not valid for one or more items in your order",
            code: "PROMO_EXCLUDED_PRODUCT",
          },
          { status: 400 },
        ),
      };
    }
  }

  // If allowed_product_ids is set, discount only the eligible items.
  const allowedProductIds = coerceIdSet(promo.allowed_product_ids);
  let eligibleSubtotal = subtotalAmount;

  if (allowedProductIds) {
    eligibleSubtotal = orderItems.reduce((sum, it) => {
      if (!allowedProductIds.has(String(it.product_id))) {
        return sum;
      }
      return sum + Number(it.total_price || 0);
    }, 0);

    eligibleSubtotal = Math.round(eligibleSubtotal * 100) / 100;

    if (eligibleSubtotal <= 0) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: "Promo code doesn't apply to items in your order",
            code: "PROMO_NO_ELIGIBLE_ITEMS",
          },
          { status: 400 },
        ),
      };
    }
  }

  // First order only
  if (promo.first_order_only === true) {
    const rows = await sql("SELECT id FROM orders WHERE user_id = $1 LIMIT 1", [
      userId,
    ]);
    if (rows.length > 0) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: "Promo code is only valid for your first order",
            code: "PROMO_FIRST_ORDER_ONLY",
          },
          { status: 400 },
        ),
      };
    }
  }

  // Usage limit total
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
        return {
          ok: false,
          response: corsJson(
            request,
            {
              error: "Promo code has reached its usage limit",
              code: "PROMO_USAGE_LIMIT_TOTAL",
            },
            { status: 400 },
          ),
        };
      }
    }
  }

  // Usage limit per user
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
        return {
          ok: false,
          response: corsJson(
            request,
            {
              error: "Promo code usage limit reached for this account",
              code: "PROMO_USAGE_LIMIT_USER",
            },
            { status: 400 },
          ),
        };
      }
    }
  }

  const promoDiscount = calcPromoDiscount({ promo, eligibleSubtotal });

  if (promoDiscount <= 0) {
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Promo code does not apply", code: "PROMO_NO_DISCOUNT" },
        { status: 400 },
      ),
    };
  }

  return { ok: true, promoDiscount, promoCodeId: promo.id };
}
