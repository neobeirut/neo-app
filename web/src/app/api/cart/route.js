// BUILD_CACHE_BUSTER: 1785664862764
﻿import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

const CART_ROUTE_VERSION = "2026-08-02-cart-schema-aligned-v1";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).trim().replace(/[^0-9]/g, "");
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
  return String(parsed);
}

async function resolveUserId(request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone");
  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phone = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);
  const headerUserId = getHeaderUserId(request);

  if (headerUserId) {
    return headerUserId;
  }

  if (phone) {
    const user = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phone],
    );
    if (user.length > 0) {
      return String(user[0].id);
    }
  }

  try {
    const { getToken } = await import("@auth/core/jwt");
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: String(process.env.AUTH_URL || "").startsWith("https"),
    });

    if (jwt?.sub) {
      return String(jwt.sub);
    }
  } catch (e) {
    // JWT fallback optional
  }

  return null;
}

// Get user cart
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id");
    const userId = await resolveUserId(request);

    if (!userId) {
      return corsJson(request, {
        route_version: CART_ROUTE_VERSION,
        cart_items: [],
        unauthenticated: true,
      });
    }

    const cartItems = await sql`
      SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.unit_price,
        ci.notes as comment,
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
        ON p.id = pbs.product_id ${branchId ? sql`AND pbs.branch_id = ${Number(branchId)}` : sql``}
      LEFT JOIN cart_item_addons cia ON ci.id = cia.cart_item_id
      LEFT JOIN product_addons pa ON cia.addon_id = pa.id
      WHERE ci.user_id = ${String(userId)}
      GROUP BY ci.id, p.id, pbs.price, pbs.quantity_on_hand
      ORDER BY ci.id DESC
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
    const body = (await request.json().catch(() => ({}))) || {};
    const { product_id, quantity = 1, unit_price = 0, notes, selected_addons = [] } = body;

    const userId = await resolveUserId(request);
    if (!userId) {
      return corsJson(request, { error: "Authentication required" }, { status: 401 });
    }

    if (!product_id) {
      return corsJson(request, { error: "Product ID is required" }, { status: 400 });
    }

    const [newItem] = await sql`
      INSERT INTO cart_items (user_id, product_id, quantity, unit_price, notes)
      VALUES (${String(userId)}, ${Number(product_id)}, ${Number(quantity)}, ${Number(unit_price)}, ${notes || null})
      RETURNING id
    `;

    const cartItemId = newItem.id;

    if (Array.isArray(selected_addons) && selected_addons.length > 0) {
      for (const addonId of selected_addons) {
        await sql`
          INSERT INTO cart_item_addons (cart_item_id, addon_id, quantity)
          VALUES (${cartItemId}, ${Number(addonId)}, 1)
        `;
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
      return corsJson(request, { error: "Authentication required" }, { status: 401 });
    }

    if (!cartItemId) {
      return corsJson(request, { error: "Cart item ID is required" }, { status: 400 });
    }

    await sql`
      DELETE FROM cart_items 
      WHERE id = ${Number(cartItemId)} AND user_id = ${String(userId)}
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
