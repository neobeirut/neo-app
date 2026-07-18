import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function normalizePhone(phone) {
  if (!phone) return null;
  // Normalize to digits only so different formats still match (e.g. +961..., 961..., spaces).
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

  if (phone) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    // Some older users may have NULL phone in DB; accept header user id in that case.
    if (!dbPhone) {
      console.warn(
        "[cart/update] X-Auth-User-Id user has no phone in DB; accepting header user id",
        {
          headerUserId,
        },
      );
      return Number(rows[0].id);
    }

    if (dbPhone !== phone) {
      console.warn(
        "[cart/update] Ignoring X-Auth-User-Id because phone mismatch",
        {
          headerUserId,
        },
      );
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
    console.error("[cart/update] dynamic import @auth/core/jwt failed:", e);
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
    console.error("[cart/update] getToken error:", e);
  }

  return null;
}

async function resolveUserId(request, phoneRaw) {
  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);

  // Phone-auth best path: explicit user id header, but only if it matches phone when provided.
  const headerResolved = await resolveUserIdFromHeader(request, phone);
  if (headerResolved) {
    return headerResolved;
  }

  // Phone-auth fallback first (native)
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

  if (!row) return null;

  return {
    inventoryApplies: !!row.inventory_applies,
    productName: row.name,
    quantityOnHand: row.quantity_on_hand,
  };
}

// Update cart item quantity / customizations / comment / selected_addons
export async function PUT(request) {
  try {
    const {
      cart_item_id,
      quantity,
      customizations,
      comment,
      phone,
      selected_addons,
    } = await request.json();

    const userId = await resolveUserId(request, phone);

    if (!userId) {
      return corsJson(
        request,
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!cart_item_id) {
      return corsJson(
        request,
        { error: "Cart item ID is required" },
        { status: 400 },
      );
    }

    const [cartItem] = await sql`
      SELECT id, product_id, branch_id, quantity
      FROM cart_items
      WHERE id = ${cart_item_id} AND user_id = ${userId}
    `;

    if (!cartItem) {
      return corsJson(
        request,
        { error: "Cart item not found" },
        { status: 404 },
      );
    }

    // Quantity updates are handled separately (includes inventory validation)
    if (quantity !== undefined) {
      const desiredQty = Number(quantity);
      if (Number.isNaN(desiredQty)) {
        return corsJson(
          request,
          { error: "Quantity must be a number" },
          { status: 400 },
        );
      }

      if (desiredQty < 1) {
        return corsJson(
          request,
          { error: "Quantity must be at least 1" },
          { status: 400 },
        );
      }

      // Inventory validation
      const inv = await getInventoryForProductBranch(
        cartItem.product_id,
        cartItem.branch_id,
      );

      if (inv?.inventoryApplies) {
        const qoh =
          inv.quantityOnHand === null || inv.quantityOnHand === undefined
            ? 0
            : Number(inv.quantityOnHand);

        const [{ other_total }] = await sql`
          SELECT COALESCE(SUM(quantity), 0) as other_total
          FROM cart_items
          WHERE user_id = ${userId}
            AND branch_id = ${cartItem.branch_id}
            AND product_id = ${cartItem.product_id}
            AND id <> ${cart_item_id}
        `;

        const other = Number(other_total || 0);

        if (other + desiredQty > qoh) {
          const maxQtyForThisLine = Math.max(0, qoh - other);
          return corsJson(
            request,
            {
              error: `Only ${maxQtyForThisLine} left for ${inv.productName}`,
              code: "INSUFFICIENT_STOCK",
              product_id: cartItem.product_id,
              branch_id: cartItem.branch_id,
              quantity_on_hand: qoh,
              quantity_in_cart_other_lines: other,
              max_quantity_for_this_item: maxQtyForThisLine,
            },
            { status: 409 },
          );
        }
      }

      await sql`
        UPDATE cart_items 
        SET quantity = ${desiredQty}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${cart_item_id} AND user_id = ${userId}
      `;

      // If this request is ONLY a quantity update, return immediately.
      if (
        customizations === undefined &&
        comment === undefined &&
        selected_addons === undefined
      ) {
        return corsJson(request, { message: "Cart updated successfully" });
      }
    }

    // Details update (customizations and/or comment and/or selected_addons)
    if (
      customizations === undefined &&
      comment === undefined &&
      selected_addons === undefined
    ) {
      return corsJson(
        request,
        {
          error:
            "Quantity, customizations, comment, or selected_addons must be provided",
        },
        { status: 400 },
      );
    }

    const normalizedComment =
      comment === null || comment === undefined
        ? null
        : String(comment).trim() || null;

    // Transaction so we don't end up with cart_items updated but addons not (or vice-versa)
    // Prepare all queries first
    const queries = [];

    // Update cart_items with customizations and/or comment
    if (customizations !== undefined && comment !== undefined) {
      queries.push(sql`
        UPDATE cart_items
        SET customizations = ${JSON.stringify(customizations)}::jsonb,
            comment = ${normalizedComment},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${cart_item_id} AND user_id = ${userId}
      `);
    } else if (customizations !== undefined) {
      queries.push(sql`
        UPDATE cart_items
        SET customizations = ${JSON.stringify(customizations)}::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${cart_item_id} AND user_id = ${userId}
      `);
    } else if (comment !== undefined) {
      queries.push(sql`
        UPDATE cart_items
        SET comment = ${normalizedComment},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${cart_item_id} AND user_id = ${userId}
      `);
    }

    // Handle selected_addons if provided
    if (selected_addons !== undefined) {
      const ids = Array.isArray(selected_addons)
        ? selected_addons
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x))
        : [];

      // Clear existing add-ons for this cart item
      queries.push(
        sql`DELETE FROM cart_item_addons WHERE cart_item_id = ${cart_item_id}`,
      );

      if (ids.length > 0) {
        // ✅ FIX: Validate addons from the SAME SOURCE as the GET endpoint
        // First try: product_customizations (preferred, matches admin flow)
        let rows = await sql(
          `SELECT id, price FROM product_customizations 
           WHERE product_id = $1 
             AND id = ANY($2::int[]) 
             AND customization_type = 'addon'
             AND is_active IS DISTINCT FROM FALSE`,
          [Number(cartItem.product_id), ids],
        );

        // Second try: legacy product_addons table if none found
        if (rows.length === 0) {
          rows = await sql(
            `SELECT id, price FROM product_addons 
             WHERE product_id = $1 
               AND id = ANY($2::int[]) 
               AND is_active = true`,
            [Number(cartItem.product_id), ids],
          );
        }

        const foundIds = new Set(rows.map((r) => Number(r.id)));
        const missing = ids.filter((id) => !foundIds.has(Number(id)));
        if (missing.length > 0) {
          return corsJson(
            request,
            {
              error: `Invalid addon(s) for this product: ${missing.join(", ")}`,
            },
            { status: 400 },
          );
        }

        for (const row of rows) {
          queries.push(sql`
            INSERT INTO cart_item_addons (cart_item_id, product_addon_id, quantity, price)
            VALUES (${cart_item_id}, ${Number(row.id)}, 1, ${row.price})
          `);
        }
      }

      // Touch updated_at so carts reorder consistently
      queries.push(sql`
        UPDATE cart_items
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ${cart_item_id} AND user_id = ${userId}
      `);
    }

    // Execute all queries in a transaction
    if (queries.length > 0) {
      await sql.transaction(queries);
    }

    return corsJson(request, { message: "Cart updated successfully" });
  } catch (error) {
    console.error("Error updating cart:", error);

    const msg = String(error?.message || "");
    if (msg.startsWith("Invalid addon(s)")) {
      return corsJson(request, { error: msg }, { status: 400 });
    }

    return corsJson(
      request,
      { error: "Failed to update cart" },
      { status: 500 },
    );
  }
}
