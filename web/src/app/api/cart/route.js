import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

const CART_ROUTE_VERSION = "2026-10-15-cart-schema-restored-v1";

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

function phonesMatch(phoneA, phoneB) {
  if (!phoneA || !phoneB) return false;
  const a = String(phoneA).replace(/[^0-9]/g, "");
  const b = String(phoneB).replace(/[^0-9]/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  const cleanA = a.startsWith("961") ? a.slice(3) : a.replace(/^0+/, "");
  const cleanB = b.startsWith("961") ? b.slice(3) : b.replace(/^0+/, "");
  if (cleanA && cleanB && cleanA === cleanB) return true;
  if (cleanA.length >= 7 && cleanB.length >= 7) {
    return cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA);
  }
  return false;
}

async function findUserByPhone(phone) {
  if (!phone) return null;
  const clean = phone.startsWith("961") ? phone.slice(3) : phone.replace(/^0+/, "");
  const rows = await sql(
    `SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm 
     FROM auth_users 
     WHERE (regexp_replace(phone, '[^0-9]', '', 'g') = $1 
        OR regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || $2)
       AND is_active = true 
     ORDER BY id DESC LIMIT 5`,
    [phone, clean],
  );

  for (const row of rows) {
    if (phonesMatch(row.phone_norm, phone)) {
      return Number(row.id);
    }
  }
  return null;
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

  if (phone) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    if (!dbPhone) {
      console.warn(
        "[cart] X-Auth-User-Id user has no phone in DB; accepting header user id",
        { headerUserId },
      );
      return Number(rows[0].id);
    }

    if (!phonesMatch(dbPhone, phone)) {
      console.warn("[cart] Ignoring X-Auth-User-Id because phone mismatch", {
        headerUserId,
        dbPhone,
        phone,
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

async function tryGetJwtUserId(request) {
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

async function resolveUserId(request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone");

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);

  const headerResolved = await resolveUserIdFromHeader(request, phone);
  if (headerResolved) {
    return headerResolved;
  }

  if (phone) {
    const user = await findUserByPhone(phone);
    if (user) {
      return user;
    }
  }

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) {
    return jwtUserId;
  }

  return null;
}

async function resolveUserIdFromBody(request) {
  const body = await request.json().catch(() => ({}));

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone = normalizePhone(body?.phone) || normalizePhone(headerPhoneRaw);

  const headerResolved = await resolveUserIdFromHeader(request, phone);
  if (headerResolved) {
    return { userId: headerResolved, body };
  }

  if (phone) {
    const user = await findUserByPhone(phone);
    if (user) {
      return { userId: user, body };
    }
  }

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) {
    return { userId: jwtUserId, body };
  }

  return { userId: null, body };
}

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

// Get user cart
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("probe") === "1") {
      return corsJson(request, {
        ok: true,
        route_version: CART_ROUTE_VERSION,
        url: request.url,
      });
    }

    const branchId = searchParams.get("branch_id");
    const userId = await resolveUserId(request);

    if (!userId) {
      return corsJson(request, {
        route_version: CART_ROUTE_VERSION,
        cart_items: [],
        unauthenticated: true,
      });
    }

    if (!branchId) {
      return corsJson(
        request,
        {
          route_version: CART_ROUTE_VERSION,
          error: "Branch ID is required",
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
            'addon_id', cia.product_addon_id,
            'name', COALESCE(pa.name, pc.ingredient, 'Addon'),
            'price', COALESCE(cia.price, pa.price, pc.price, 0)
          )
        ) FILTER (WHERE cia.product_addon_id IS NOT NULL) as addons
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_branch_status pbs 
        ON p.id = pbs.product_id AND pbs.branch_id = ${Number(branchId)}
      LEFT JOIN cart_item_addons cia ON ci.id = cia.cart_item_id
      LEFT JOIN product_addons pa ON cia.product_addon_id = pa.id
      LEFT JOIN product_customizations pc ON cia.product_addon_id = pc.id AND pc.customization_type = 'addon'
      WHERE ci.user_id = ${Number(userId)} AND ci.branch_id = ${Number(branchId)}
      GROUP BY ci.id, ci.product_id, ci.quantity, ci.branch_id, ci.customizations, ci.comment, p.name, p.inventory_applies, p.status, COALESCE(pbs.price, p.price), pbs.quantity_on_hand, p.image_url, p.description
      ORDER BY ci.created_at DESC
    `;

    return corsJson(request, {
      route_version: CART_ROUTE_VERSION,
      cart_items: cartItems,
    });
  } catch (error) {
    console.error("[CART GET] Error fetching cart:", error);
    return corsJson(
      request,
      { route_version: CART_ROUTE_VERSION, error: "Failed to fetch cart", details: error.message },
      { status: 500 },
    );
  }
}

// Add item to cart
export async function POST(request) {
  try {
    const { userId, body } = await resolveUserIdFromBody(request);

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

    if (!product_id || !branch_id) {
      return corsJson(
        request,
        { error: "Product ID and Branch ID are required" },
        { status: 400 },
      );
    }

    const normalizedComment =
      comment === null || comment === undefined
        ? null
        : String(comment).trim() || null;

    const normalizedSelectedAddons = Array.isArray(selected_addons)
      ? Array.from(
          new Set(
            selected_addons
              .map((x) => Number(x))
              .filter((x) => Number.isFinite(x)),
          ),
        ).sort((a, b) => a - b)
      : [];

    const normalizedCustomizations = normalizeCustomizations(customizations);
    const customizationsJson = JSON.stringify(normalizedCustomizations);

    // Inventory check
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
        WHERE user_id = ${Number(userId)} AND branch_id = ${Number(branch_id)} AND product_id = ${Number(product_id)}
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

    // Check if matching item already exists in cart
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
        SET quantity = quantity + ${Number(quantity)}, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existingItem.id}
      `;
      cartItemId = existingItem.id;
    } else {
      const result = await sql`
        INSERT INTO cart_items (user_id, product_id, branch_id, quantity, customizations, comment)
        VALUES (${Number(userId)}, ${Number(product_id)}, ${Number(branch_id)}, ${Number(quantity)}, ${JSON.stringify(normalizedCustomizations)}::jsonb, ${normalizedComment})
        RETURNING id
      `;
      cartItemId = result[0].id;

      if (normalizedSelectedAddons.length > 0) {
        let addonRows = await sql(
          `SELECT id, price FROM product_customizations 
           WHERE product_id = $1 
             AND id = ANY($2::int[]) 
             AND customization_type = 'addon'
             AND is_active IS DISTINCT FROM FALSE`,
          [Number(product_id), normalizedSelectedAddons],
        );

        if (addonRows.length === 0) {
          addonRows = await sql(
            `SELECT id, price FROM product_addons 
             WHERE product_id = $1 
               AND id = ANY($2::int[]) 
               AND is_active = true`,
            [Number(product_id), normalizedSelectedAddons],
          );
        }

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
      success: true,
      message: "Item added to cart successfully",
      cart_item_id: cartItemId,
    });
  } catch (error) {
    console.error("[CART POST] Error adding to cart:", error);
    return corsJson(
      request,
      { error: "Failed to add to cart", details: error.message },
      { status: 500 },
    );
  }
}

// Delete item from cart
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cartItemId = searchParams.get("id");
    const userId = await resolveUserId(request);

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

    await sql`
      DELETE FROM cart_items 
      WHERE id = ${Number(cartItemId)} AND user_id = ${Number(userId)}
    `;

    return corsJson(request, { success: true, message: "Item removed from cart" });
  } catch (error) {
    console.error("[CART DELETE] Error removing from cart:", error);
    return corsJson(
      request,
      { error: "Failed to remove item", details: error.message },
      { status: 500 },
    );
  }
}
