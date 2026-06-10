import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

const CART_ROUTE_VERSION = "2026-01-19-cart-route-v1";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function normalizePhone(phone) {
  if (!phone) return null;
  // IMPORTANT: normalize to digits only so "+961 ..." and "961..." match.
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

async function resolveUserIdFromHeader(request, phone) {
  const headerUserId = getHeaderUserId(request);
  if (!headerUserId) return null;

  // If the client also supplied a phone (phone OTP flow), validate that the header userId
  // actually belongs to that phone.
  if (phone) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    // IMPORTANT: Some users may have a NULL phone in auth_users (older data).
    // In that case we can't validate, so we accept the header user id to keep cart stable.
    if (!dbPhone) {
      console.warn(
        "[cart] X-Auth-User-Id user has no phone in DB; accepting header user id",
        {
          headerUserId,
        },
      );
      return Number(rows[0].id);
    }

    if (dbPhone !== phone) {
      console.warn("[cart] Ignoring X-Auth-User-Id because phone mismatch", {
        headerUserId,
      });
      return null;
    }

    return Number(rows[0].id);
  }

  const rows =
    await sql`SELECT id FROM auth_users WHERE id = ${headerUserId} AND is_active = true`;
  if (rows.length === 0) return null;
  return Number(rows[0].id);
}

// Robustly resolve user id for mobile + web.
// IMPORTANT: Prefer phone resolution BEFORE getToken.
// In some runtimes auth() can throw (or auth module can fail to init); we must not depend on it for phone OTP carts.
async function resolveUserId(request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone");

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);

  // Phone-auth best path: if the client tells us the user id, trust it ONLY if it matches the phone (when provided).
  const headerResolved = await resolveUserIdFromHeader(request, phone);
  if (headerResolved) {
    return headerResolved;
  }

  // Phone-auth fallback (most common for native)
  if (phone) {
    const user = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phone],
    );
    if (user.length > 0) {
      return Number(user[0].id);
    }
  }

  // Bearer / cookie JWT fallback
  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) {
    return jwtUserId;
  }

  return null;
}

async function tryGetJwtUserId(request) {
  // IMPORTANT: dynamic import so this route still runs even if @auth/core/jwt breaks in some prod runtimes.
  let getToken;
  try {
    ({ getToken } = await import("@auth/core/jwt"));
  } catch (e) {
    console.error("[cart] dynamic import @auth/core/jwt failed:", e);
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
  } catch (e) {
    console.error("[cart] getToken error:", e);
  }

  return null;
}

async function resolveUserIdFromBody(request) {
  // Always read the body exactly once (request.json() can only be consumed once)
  const body = await request.json().catch(() => ({}));

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone = normalizePhone(body?.phone) || normalizePhone(headerPhoneRaw);

  // Phone-auth best path: header user id, but only if it matches the phone (when provided)
  const headerResolved = await resolveUserIdFromHeader(request, phone);
  if (headerResolved) {
    return { userId: headerResolved, body };
  }

  // Phone-auth fallback (most common for native)
  if (phone) {
    const user = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phone],
    );
    if (user.length > 0) {
      return { userId: Number(user[0].id), body };
    }
  }

  // Bearer / cookie JWT fallback
  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) {
    return { userId: jwtUserId, body };
  }

  return { userId: null, body };
}

// NEW: normalize cart customizations so JSON comparisons are stable across clients.
// We sort and trim fields to avoid treating the same selection as "different" due to array order.
function normalizeCustomizations(customizations) {
  const list = Array.isArray(customizations) ? customizations : [];

  const normalized = list
    .map((c) => {
      if (!c || typeof c !== "object") return null;

      const id = Number(c.id);
      if (!Number.isFinite(id)) return null;

      const typeRaw = c.type || c.customization_type;
      const type =
        typeRaw === null || typeRaw === undefined ? "" : String(typeRaw);

      const ingredient =
        c.ingredient === null || c.ingredient === undefined
          ? null
          : String(c.ingredient);

      const option_group_name =
        c.option_group_name === null || c.option_group_name === undefined
          ? null
          : String(c.option_group_name);

      const priceNum = Number(c.price || 0);
      const price = Number.isFinite(priceNum) ? priceNum : 0;

      return { id, type, ingredient, option_group_name, price };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const t = String(a.type).localeCompare(String(b.type));
      if (t !== 0) return t;
      const g = String(a.option_group_name || "").localeCompare(
        String(b.option_group_name || ""),
      );
      if (g !== 0) return g;
      return a.id - b.id;
    });

  return normalized;
}

async function getInventoryForProductBranch(productId, branchId) {
  const [row] = await sql`
    SELECT 
      p.inventory_applies,
      p.name,
      COALESCE(pbs.quantity_on_hand, NULL) as quantity_on_hand
    FROM products p
    LEFT JOIN product_branch_status pbs
      ON p.id = pbs.product_id AND pbs.branch_id = ${branchId}
    WHERE p.id = ${productId}
  `;

  if (!row) {
    return null;
  }

  return {
    inventoryApplies: !!row.inventory_applies,
    productName: row.name,
    quantityOnHand: row.quantity_on_hand,
  };
}

// Get user's cart
export async function GET(request) {
  try {
    console.log("[CART GET] ========== FETCHING CART ==========");

    const { searchParams } = new URL(request.url);

    // NEW: probe mode for published-debugging. This should never return `null`.
    if (searchParams.get("probe") === "1") {
      return corsJson(request, {
        ok: true,
        route_version: CART_ROUTE_VERSION,
        url: request.url,
      });
    }

    const branchId = searchParams.get("branch_id");
    const debugRequested = searchParams.get("debug") === "1";

    const hasAuthPhoneHeader = !!(
      request.headers.get("x-auth-phone") ||
      request.headers.get("X-Auth-Phone") ||
      request.headers.get("X-AUTH-PHONE")
    );

    const hasAuthUserIdHeader = !!(
      request.headers.get("x-auth-user-id") ||
      request.headers.get("X-Auth-User-Id") ||
      request.headers.get("X-AUTH-USER-ID")
    );

    const userId = await resolveUserId(request);

    console.log("[CART GET] branch_id:", branchId);
    console.log("[CART GET] resolved user_id:", userId);
    console.log("[CART GET] has X-Auth-Phone header:", hasAuthPhoneHeader);
    console.log("[CART GET] has X-Auth-User-Id header:", hasAuthUserIdHeader);

    const isProd =
      process.env.ENV === "production" || process.env.NODE_ENV === "production";

    // Allow explicit debugging even in prod builds during troubleshooting.
    // This only echoes non-sensitive resolution info (no secrets/tokens).
    const includeDebug = !isProd || debugRequested;

    const debug = includeDebug
      ? {
          resolved_user_id: userId,
          branch_id: branchId,
          has_auth_phone_header: hasAuthPhoneHeader,
          has_auth_user_id_header: hasAuthUserIdHeader,
        }
      : undefined;

    if (!userId) {
      return corsJson(request, {
        route_version: CART_ROUTE_VERSION,
        cart_items: [],
        unauthenticated: true,
        ...(debug ? { debug } : {}),
      });
    }

    if (!branchId) {
      return corsJson(
        request,
        {
          route_version: CART_ROUTE_VERSION,
          error: "Branch ID is required",
          ...(debug ? { debug } : {}),
        },
        { status: 400 },
      );
    }

    const cartItems = await sql`
      SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.branch_id,
        ci.customizations,
        ci.comment,
        p.name,
        p.inventory_applies,
        p.status,
        COALESCE(pbs.price, p.price) as price,
        pbs.quantity_on_hand,
        p.image_url,
        p.description,
        json_agg(
          DISTINCT jsonb_build_object(
            'addon_id', pa.id,
            'name', pa.name,
            'price', pa.price
          )
        ) FILTER (WHERE pa.id IS NOT NULL) as addons
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_branch_status pbs 
        ON p.id = pbs.product_id AND pbs.branch_id = ${branchId}
      LEFT JOIN cart_item_addons cia ON ci.id = cia.cart_item_id
      LEFT JOIN product_addons pa ON cia.product_addon_id = pa.id
      WHERE ci.user_id = ${userId} AND ci.branch_id = ${branchId}
      GROUP BY ci.id, ci.product_id, ci.quantity, ci.branch_id, ci.customizations, ci.comment, p.name, p.inventory_applies, p.status, COALESCE(pbs.price, p.price), pbs.quantity_on_hand, p.image_url, p.description
      ORDER BY ci.created_at DESC
    `;

    console.log("[CART GET] items returned:", cartItems?.length || 0);

    return corsJson(request, {
      route_version: CART_ROUTE_VERSION,
      cart_items: cartItems,
      ...(debug ? { debug } : {}),
    });
  } catch (error) {
    console.error("[CART GET] ❌ Error fetching cart:", error);
    return corsJson(
      request,
      { route_version: CART_ROUTE_VERSION, error: "Failed to fetch cart" },
      { status: 500 },
    );
  }
}

// Add item to cart
export async function POST(request) {
  try {
    const { userId, body } = await resolveUserIdFromBody(request);

    console.log("[CART POST] resolved user_id:", userId);
    console.log("[CART POST] body branch_id:", body?.branch_id);
    console.log("[CART POST] body product_id:", body?.product_id);

    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const {
      product_id,
      branch_id,
      quantity = 1,
      selected_addons = [],
      customizations = [],
      comment,
    } = body || {};

    const normalizedComment =
      comment === null || comment === undefined
        ? null
        : String(comment).trim() || null;

    // Normalize add-ons to a stable, unique, sorted int[]
    const normalizedSelectedAddons = Array.isArray(selected_addons)
      ? Array.from(
          new Set(
            selected_addons
              .map((x) => Number(x))
              .filter((x) => Number.isFinite(x)),
          ),
        ).sort((a, b) => a - b)
      : [];

    // ✅ Normalize customizations so cart item uniqueness is stable.
    const normalizedCustomizations = normalizeCustomizations(customizations);
    const customizationsJson = JSON.stringify(normalizedCustomizations);

    if (!product_id || !branch_id) {
      return corsJson(
        request,
        { error: "Product ID and Branch ID are required" },
        { status: 400 },
      );
    }

    // Inventory validation (branch-specific)
    const inv = await getInventoryForProductBranch(product_id, branch_id);
    if (!inv) {
      return corsJson(request, { error: "Product not found" }, { status: 404 });
    }

    if (inv.inventoryApplies) {
      const qoh =
        inv.quantityOnHand === null || inv.quantityOnHand === undefined
          ? 0
          : Number(inv.quantityOnHand);

      const [{ in_cart_total }] = await sql`
        SELECT COALESCE(SUM(quantity), 0) as in_cart_total
        FROM cart_items
        WHERE user_id = ${userId} AND branch_id = ${branch_id} AND product_id = ${product_id}
      `;

      const currentInCart = Number(in_cart_total || 0);
      const requested = Number(quantity || 0);

      if (requested < 1) {
        return corsJson(
          request,
          { error: "Quantity must be at least 1" },
          { status: 400 },
        );
      }

      if (currentInCart + requested > qoh) {
        const remaining = Math.max(0, qoh - currentInCart);
        return corsJson(
          request,
          {
            error: `Only ${remaining} left for ${inv.productName}`,
            code: "INSUFFICIENT_STOCK",
            product_id,
            branch_id,
            quantity_on_hand: qoh,
            quantity_in_cart: currentInCart,
            max_additional: remaining,
          },
          { status: 409 },
        );
      }
    }

    // Check if item with same product AND customizations AND comment AND add-ons already exists in cart
    // IMPORTANT: add-ons must be part of uniqueness; otherwise "plain" and "with add-ons" merge incorrectly.
    const allCartItems = await sql(
      `
      SELECT
        ci.id,
        ci.customizations,
        ci.comment,
        COALESCE(
          array_agg(DISTINCT cia.product_addon_id ORDER BY cia.product_addon_id)
          FILTER (WHERE cia.product_addon_id IS NOT NULL),
          '{}'::int[]
        ) as addon_ids
      FROM cart_items ci
      LEFT JOIN cart_item_addons cia ON ci.id = cia.cart_item_id
      WHERE ci.user_id = $1
        AND ci.product_id = $2
        AND ci.branch_id = $3
      GROUP BY ci.id, ci.customizations, ci.comment
      `,
      [Number(userId), Number(product_id), Number(branch_id)],
    );

    const existingItem = (allCartItems || []).find((item) => {
      const itemCustomizationsNorm = normalizeCustomizations(
        item.customizations,
      );
      const itemCustomizations = JSON.stringify(itemCustomizationsNorm);

      const itemComment =
        item.comment === null || item.comment === undefined
          ? null
          : String(item.comment);

      const itemAddonIds = Array.isArray(item.addon_ids)
        ? item.addon_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))
        : [];

      // Postgres returns the array already ordered by ORDER BY in the agg.
      const sameCustomizations = itemCustomizations === customizationsJson;
      const sameComment = itemComment === normalizedComment;
      const sameAddons =
        JSON.stringify(itemAddonIds) ===
        JSON.stringify(normalizedSelectedAddons);

      return sameCustomizations && sameComment && sameAddons;
    });

    let cartItemId;

    if (existingItem) {
      await sql`
        UPDATE cart_items 
        SET quantity = quantity + ${quantity}, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existingItem.id}
      `;
      cartItemId = existingItem.id;

      // IMPORTANT:
      // Do NOT delete/reinsert add-ons here.
      // Because add-ons are part of uniqueness, an existing match means the add-ons are already correct.
    } else {
      const result = await sql`
        INSERT INTO cart_items (user_id, product_id, branch_id, quantity, customizations, comment)
        VALUES (${userId}, ${product_id}, ${branch_id}, ${quantity}, ${normalizedCustomizations}, ${normalizedComment})
        RETURNING id
      `;
      cartItemId = result[0].id;

      // Add selected addons (only for the new cart line)
      if (normalizedSelectedAddons.length > 0) {
        // ✅ FIX: Validate addons from the SAME SOURCE as the GET endpoint
        // First try: product_customizations (preferred, matches admin flow)
        let addonRows = await sql(
          `SELECT id, price FROM product_customizations 
           WHERE product_id = $1 
             AND id = ANY($2::int[]) 
             AND customization_type = 'addon'
             AND is_active IS DISTINCT FROM FALSE`,
          [Number(product_id), normalizedSelectedAddons],
        );

        // Second try: legacy product_addons table if none found
        if (addonRows.length === 0) {
          addonRows = await sql(
            `SELECT id, price FROM product_addons 
             WHERE product_id = $1 
               AND id = ANY($2::int[]) 
               AND is_active = true`,
            [Number(product_id), normalizedSelectedAddons],
          );
        }

        // Validate all requested addons exist
        const foundIds = new Set(addonRows.map((r) => Number(r.id)));
        const missing = normalizedSelectedAddons.filter(
          (id) => !foundIds.has(Number(id)),
        );
        if (missing.length > 0) {
          return corsJson(
            request,
            {
              error: `Invalid addon(s) for this product: ${missing.join(", ")}`,
            },
            { status: 400 },
          );
        }

        for (const addonRow of addonRows) {
          await sql`
            INSERT INTO cart_item_addons (cart_item_id, product_addon_id, quantity, price)
            VALUES (${cartItemId}, ${Number(addonRow.id)}, 1, ${addonRow.price})
          `;
        }
      }
    }

    return corsJson(request, {
      message: "Item added to cart successfully",
      cart_item_id: cartItemId,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return corsJson(
      request,
      { error: "Failed to add to cart" },
      { status: 500 },
    );
  }
}

// Delete cart item
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cartItemId = searchParams.get("id");

    const headerPhoneRaw =
      request.headers.get("x-auth-phone") ||
      request.headers.get("X-Auth-Phone") ||
      request.headers.get("X-AUTH-PHONE");

    const phone =
      normalizePhone(searchParams.get("phone")) ||
      normalizePhone(headerPhoneRaw);

    let userId;

    // Auth priority: header user id (validated) -> phone -> bearer/cookie
    const headerResolved = await resolveUserIdFromHeader(request, phone);
    if (headerResolved) {
      userId = headerResolved;
    }

    // Phone fallback (IMPORTANT: even if Authorization exists but is invalid)
    if (!userId && phone) {
      const user = await sql(
        "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
        [phone],
      );
      if (user.length === 0) {
        return corsJson(
          request,
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      userId = Number(user[0].id);
    }

    // Bearer / cookie JWT fallback
    if (!userId) {
      const jwtUserId = await tryGetJwtUserId(request);
      if (jwtUserId) {
        userId = jwtUserId;
      }
    }

    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!cartItemId) {
      return corsJson(
        request,
        { error: "Cart item ID is required" },
        { status: 400 },
      );
    }

    // Delete cart item (addons will be deleted via CASCADE)
    await sql`
      DELETE FROM cart_items 
      WHERE id = ${cartItemId} AND user_id = ${userId}
    `;

    return corsJson(request, { message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing from cart:", error);
    return corsJson(
      request,
      { error: "Failed to remove item" },
      { status: 500 },
    );
  }
}
