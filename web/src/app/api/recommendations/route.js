import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function applyInventoryStatusRule(
  currentStatus,
  inventoryApplies,
  quantityOnHand,
) {
  // Normalize status strings so we don't fail equality checks due to whitespace.
  const status = currentStatus ? String(currentStatus).trim() : currentStatus;

  if (!inventoryApplies) {
    return status;
  }

  // IMPORTANT: quantity_on_hand can be NULL when branch inventory isn't set.
  // In that case, we should NOT treat it as 0 (out of stock).
  const qtyNumber =
    quantityOnHand === null || quantityOnHand === undefined
      ? null
      : Number(quantityOnHand);

  const hasQty = qtyNumber !== null && Number.isFinite(qtyNumber);

  if (
    status === "Hide from Menu" ||
    status === "Unavailable Until Further Notice"
  ) {
    return status;
  }

  // If we don't have an inventory number for this branch:
  // - we still want to respect hard-hide states above
  // - but "Unavailable Today" is usually an inventory-driven state.
  //   When qty is missing, treat it as available so recommendations don't disappear.
  if (!hasQty) {
    if (status === "Unavailable Today") {
      return "Available";
    }
    return status;
  }

  if (qtyNumber <= 0) {
    return "Unavailable Today";
  }

  if (status === "Unavailable Today") {
    return "Available";
  }

  return status;
}

function safeParseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function getSettingArray(key) {
  const rows = await sql`
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ${key}
  `;

  const raw = rows[0]?.setting_value || null;
  return safeParseJsonArray(raw);
}

function buildNotInClause(ids, startIndex) {
  if (!ids || ids.length === 0) {
    return { clause: "", values: [], nextIndex: startIndex };
  }

  const cleaned = ids.map((v) => Number(v)).filter((v) => Number.isFinite(v));

  if (cleaned.length === 0) {
    return { clause: "", values: [], nextIndex: startIndex };
  }

  const placeholders = cleaned
    .map((_, idx) => `$${startIndex + idx}`)
    .join(",");

  return {
    clause: ` AND p.id NOT IN (${placeholders}) `,
    values: cleaned,
    nextIndex: startIndex + cleaned.length,
  };
}

function scoreToUpsellType({
  currentPrice,
  candidatePrice,
  sameCategory,
  coCount,
}) {
  const cur = Number(currentPrice || 0);
  const cand = Number(candidatePrice || 0);

  if (sameCategory && cur > 0 && cand >= cur * 1.2) {
    return "premium_upgrade";
  }

  if (coCount && coCount >= 3) {
    return "bundle";
  }

  if (cand > 0 && cand <= 4.5) {
    return "add-on";
  }

  return "complement";
}

function reasonFor({ isPush, sameCategory, currentName, coCount }) {
  if (isPush) {
    return "A popular pick we recommend today.";
  }

  if (coCount && coCount > 0 && currentName) {
    return `Often paired with ${currentName}.`;
  }

  if (sameCategory) {
    return "A great match for what you’re viewing.";
  }

  return "A tasty extra to round out your order.";
}

async function getRecommendationsOverride(productId) {
  const pid = Number(productId);
  if (!Number.isFinite(pid)) return null;

  const [row] = await sql`
    SELECT mode, recommended_product_ids
    FROM product_recommendations_overrides
    WHERE product_id = ${pid}
    LIMIT 1
  `;

  if (!row) {
    return null;
  }

  return {
    mode: row.mode,
    recommendedProductIds: Array.isArray(row.recommended_product_ids)
      ? row.recommended_product_ids
      : [],
  };
}

function normalizeAndFilterAvailableProducts(rows) {
  const candidates = (rows || [])
    .map((p) => {
      const computedStatus = applyInventoryStatusRule(
        p.raw_status,
        !!p.inventory_applies,
        p.quantity_on_hand,
      );

      const qohNumber =
        p.quantity_on_hand === null || p.quantity_on_hand === undefined
          ? null
          : Number(p.quantity_on_hand);

      const hasQoh = qohNumber !== null && Number.isFinite(qohNumber);

      // Only treat as out-of-stock when inventory applies AND we have a real number.
      // (NULL means inventory isn't set for this branch, not "0".)
      const outOfStock = !!p.inventory_applies && hasQoh && qohNumber <= 0;

      const isHidden =
        computedStatus === "Hide from Menu" ||
        computedStatus === "Unavailable Until Further Notice";

      const isAvailable = computedStatus === "Available";

      return {
        ...p,
        status: computedStatus,
        outOfStock,
        isHidden,
        isAvailable,
      };
    })
    .filter((p) => {
      // RULES: Never suggest out-of-stock.
      if (p.outOfStock) return false;
      // Keep the menu clean: don't suggest hidden/on-hold.
      if (p.isHidden) return false;
      // Also avoid "Unavailable Today" for recommendations.
      if (!p.isAvailable) return false;
      return true;
    });

  return candidates;
}

function mapProductsToRecommendations(
  products,
  { upsell_type, short_reason, source },
) {
  return (products || []).map((p) => {
    const pid = Number(p.id);
    return {
      product_id: pid,
      product_name: p.name,
      short_reason,
      upsell_type,
      source, // NEW: 'manual' | 'featured' | 'ai'
      product: {
        id: pid,
        name: p.name,
        description: p.description,
        price: p.price,
        original_price: p.original_price,
        image_url: p.image_url,
        category_id: p.category_id,
        category_name: p.category_name,
      },
    };
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const branchIdRaw = body?.branch_id;
    const currentProductIdRaw = body?.current_product_id;
    const maxSuggestionsRaw = body?.max_suggestions;

    const branchId = branchIdRaw ? Number(branchIdRaw) : null;
    const currentProductId = currentProductIdRaw
      ? Number(currentProductIdRaw)
      : null;
    const maxSuggestions =
      maxSuggestionsRaw === null || maxSuggestionsRaw === undefined
        ? 4
        : Math.max(1, Math.min(8, Number(maxSuggestionsRaw)));

    const cartProductIds = Array.isArray(body?.cart_product_ids)
      ? body.cart_product_ids
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v))
      : [];

    const priceMin =
      body?.price_range && body.price_range.min !== undefined
        ? Number(body.price_range.min)
        : null;
    const priceMax =
      body?.price_range && body.price_range.max !== undefined
        ? Number(body.price_range.max)
        : null;

    if (!branchId || !currentProductId) {
      return corsJson(
        request,
        { error: "branch_id and current_product_id are required" },
        { status: 400 },
      );
    }

    const [{ current_product }] = await sql`
      SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'category_id', p.category_id,
        'price', COALESCE(pbs.price, p.price),
        'status', COALESCE(pbs.status, p.status),
        'inventory_applies', p.inventory_applies,
        'quantity_on_hand', pbs.quantity_on_hand
      ) as current_product
      FROM products p
      LEFT JOIN product_branch_status pbs
        ON p.id = pbs.product_id AND pbs.branch_id = ${branchId}
      WHERE p.id = ${currentProductId}
    `;

    if (!current_product) {
      return corsJson(request, { recommendations: [] });
    }

    const currentProduct = current_product;
    const currentName = currentProduct?.name || null;
    const currentCategoryId = currentProduct?.category_id || null;
    const currentPrice = Number(currentProduct?.price || 0);

    // ---------------------------------------------------------------------
    // Manual override control
    // - mode = 'none' => hide section entirely
    // - mode = 'manual' => show manual picks FIRST, but still show featured + AI after
    // ---------------------------------------------------------------------
    const override = await getRecommendationsOverride(currentProductId);

    if (override?.mode === "none") {
      return corsJson(request, { recommendations: [] });
    }

    const maxPerSource = maxSuggestions; // keep request contract, but apply per source now

    const manualWanted =
      override?.mode === "manual"
        ? Array.from(
            new Set(
              (override.recommendedProductIds || [])
                .map((v) => Number(v))
                .filter(
                  (v) => Number.isFinite(v) && v > 0 && v !== currentProductId,
                ),
            ),
          ).slice(0, 20)
        : [];

    const manualQuery = `
          SELECT
            p.id,
            p.name,
            p.description,
            p.category_id,
            c.name as category_name,
            COALESCE(pbs.status, p.status) as raw_status,
            COALESCE(pbs.price, p.price) as price,
            p.original_price,
            p.image_url,
            p.inventory_applies,
            pbs.quantity_on_hand
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id
          LEFT JOIN product_branch_status pbs
            ON p.id = pbs.product_id AND pbs.branch_id = $1
          WHERE p.id = ANY($2::int[])
          ORDER BY array_position($2::int[], p.id) NULLS LAST
        `;

    let manualCandidates = [];
    if (manualWanted.length > 0) {
      const manualRows = await sql(manualQuery, [branchId, manualWanted]);
      manualCandidates = normalizeAndFilterAvailableProducts(manualRows).slice(
        0,
        maxPerSource,
      );
    }

    const manualRecos = mapProductsToRecommendations(manualCandidates, {
      upsell_type: "manual",
      short_reason: "Recommended for you.",
      source: "manual",
    });

    // ---------------------------------------------------------------------
    // Build the full candidate list once (used by Featured and AI)
    // ---------------------------------------------------------------------

    const pushProductIds = await getSettingArray("push_products");
    const pushCategoryIds = await getSettingArray("push_categories");

    const excludeIds = Array.from(
      new Set([currentProductId, ...cartProductIds, ...manualWanted]),
    );

    // Build candidate products list for this branch.
    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        c.name as category_name,
        COALESCE(pbs.status, p.status) as raw_status,
        COALESCE(pbs.price, p.price) as price,
        p.original_price,
        p.image_url,
        p.inventory_applies,
        pbs.quantity_on_hand,
        p.is_featured
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_branch_status pbs
        ON p.id = pbs.product_id AND pbs.branch_id = $1
      WHERE 1=1
    `;

    const values = [branchId];
    let paramIndex = 2;

    const notIn = buildNotInClause(excludeIds, paramIndex);
    query += notIn.clause;
    values.push(...notIn.values);
    paramIndex = notIn.nextIndex;

    // Price range guard (optional)
    if (Number.isFinite(priceMin)) {
      query += ` AND COALESCE(pbs.price, p.price) >= $${paramIndex}`;
      values.push(priceMin);
      paramIndex++;
    }

    if (Number.isFinite(priceMax)) {
      query += ` AND COALESCE(pbs.price, p.price) <= $${paramIndex}`;
      values.push(priceMax);
      paramIndex++;
    }

    query += ` ORDER BY p.name LIMIT 200`;

    const rows = await sql(query, values);
    const candidates = normalizeAndFilterAvailableProducts(rows);

    // ---------------------------------------------------------------------
    // Featured / Push (second) — now always appended after Manual
    // ---------------------------------------------------------------------
    const pushSet = new Set(
      (pushProductIds || [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v)),
    );

    const pushCatSet = new Set(
      (pushCategoryIds || [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v)),
    );

    const featuredOnly = candidates.filter((p) => {
      const pid = Number(p.id);
      const catId = Number(p.category_id);
      return !!p.is_featured || pushSet.has(pid) || pushCatSet.has(catId);
    });

    const pushOrder = (pushProductIds || [])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));

    const sortedFeatured = [...featuredOnly].sort((a, b) => {
      const aId = Number(a.id);
      const bId = Number(b.id);
      const aIdx = pushOrder.indexOf(aId);
      const bIdx = pushOrder.indexOf(bId);

      const aRank = aIdx >= 0 ? aIdx : 99999;
      const bRank = bIdx >= 0 ? bIdx : 99999;

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const limitedFeatured = sortedFeatured.slice(0, maxPerSource);

    const featuredRecos = mapProductsToRecommendations(limitedFeatured, {
      upsell_type: "featured",
      short_reason: "A featured pick we recommend today.",
      source: "featured",
    });

    // ---------------------------------------------------------------------
    // AI recommendations (third) — pick from the remaining candidate pool
    // ---------------------------------------------------------------------

    const excludedAfterFeatured = new Set([
      ...manualRecos.map((r) => Number(r.product_id)),
      ...featuredRecos.map((r) => Number(r.product_id)),
    ]);

    const aiCandidatesPool = candidates.filter((p) => {
      const pid = Number(p.id);
      return !excludedAfterFeatured.has(pid);
    });

    const together = await sql`
      SELECT oi2.product_id, COUNT(*)::int as together_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN order_items oi2 ON oi2.order_id = o.id AND oi2.product_id <> oi.product_id
      WHERE oi.product_id = ${currentProductId}
        AND o.branch_id = ${branchId}
      GROUP BY oi2.product_id
      ORDER BY together_count DESC
      LIMIT 50
    `;

    const togetherMap = new Map();
    for (const row of together) {
      const pid = Number(row.product_id);
      const c = Number(row.together_count || 0);
      if (Number.isFinite(pid)) {
        togetherMap.set(pid, c);
      }
    }

    const scored = aiCandidatesPool.map((p) => {
      const pid = Number(p.id);
      const coCount = togetherMap.get(pid) || 0;
      const sameCategory =
        currentCategoryId !== null &&
        currentCategoryId !== undefined &&
        Number(p.category_id) === Number(currentCategoryId);

      const coWeight = coCount > 0 ? Math.min(500, coCount * 25) : 0;
      const categoryWeight = sameCategory ? 150 : 0;
      const priceWeight =
        Number(p.price || 0) > 0 ? Math.min(200, Number(p.price || 0) * 4) : 0;

      const score = coWeight + categoryWeight + priceWeight;

      const upsell_type = scoreToUpsellType({
        currentPrice,
        candidatePrice: p.price,
        sameCategory,
        coCount,
      });

      const short_reason = reasonFor({
        isPush: false,
        sameCategory,
        currentName,
        coCount,
      });

      return {
        score,
        product_id: pid,
        product_name: p.name,
        short_reason,
        upsell_type,
        source: "ai",
        product: {
          id: pid,
          name: p.name,
          description: p.description,
          price: p.price,
          original_price: p.original_price,
          image_url: p.image_url,
          category_id: p.category_id,
          category_name: p.category_name,
        },
      };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const limited = sorted.slice(0, maxPerSource);

    const aiRecos = limited.map(({ score, product, ...rest }) => {
      const words = String(rest.short_reason || "")
        .split(/\s+/)
        .filter(Boolean);
      const short_reason =
        words.length > 12 ? words.slice(0, 12).join(" ") : rest.short_reason;

      return {
        ...rest,
        short_reason,
        product,
      };
    });

    // ---------------------------------------------------------------------
    // Final output: Manual → Featured → AI (all shown, in that order)
    // ---------------------------------------------------------------------

    const output = [...manualRecos, ...featuredRecos, ...aiRecos];

    return corsJson(request, { recommendations: output });
  } catch (error) {
    console.error("[api/recommendations] Error:", error);
    return corsJson(
      request,
      { error: "Failed to generate recommendations" },
      { status: 500 },
    );
  }
}
