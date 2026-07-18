import sql from "@/app/api/utils/sql";

function normalizePhone(phone) {
  if (!phone) return null;
  // Digits only to match various formats.
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

async function resolveUserIdFromHeader(request, phoneNorm) {
  const headerUserId = getHeaderUserId(request);
  if (!headerUserId) return null;

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') as phone_norm FROM auth_users WHERE id = $1 AND is_active = true",
      [headerUserId],
    );

    if (rows.length === 0) return null;

    const dbPhone = rows[0]?.phone_norm ? String(rows[0].phone_norm) : null;

    if (!dbPhone) {
      return Number(rows[0].id);
    }

    if (dbPhone !== phoneNorm) {
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
    return null;
  }

  return null;
}

async function resolveUserId(request, phoneRaw) {
  const { searchParams } = new URL(request.url);

  const queryPhone = searchParams.get("phone");

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phoneNorm =
    normalizePhone(phoneRaw) ||
    normalizePhone(queryPhone) ||
    normalizePhone(headerPhoneRaw);

  const headerResolved = await resolveUserIdFromHeader(request, phoneNorm);
  if (headerResolved) return headerResolved;

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phoneNorm],
    );
    if (rows.length > 0) return Number(rows[0].id);
  }

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) return jwtUserId;

  return null;
}

// GET - Fetch user's favorites
export async function GET(request) {
  try {
    const userId = await resolveUserId(request);

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const favorites = await sql`
      SELECT 
        uf.id,
        uf.product_id,
        uf.created_at,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.image_url,
        p.category_id,
        p.rating,
        p.prep_time,
        c.name as category_name,
        c.section as category_section
      FROM user_favorites uf
      JOIN products p ON uf.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE uf.user_id = ${userId}
      ORDER BY c.display_order, c.name, p.name
    `;

    return Response.json({ favorites });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return Response.json(
      { error: "Failed to fetch favorites" },
      { status: 500 },
    );
  }
}

// POST - Add to favorites
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { product_id } = body;

    const userId = await resolveUserId(request, body?.phone);

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!product_id) {
      return Response.json(
        { error: "Product ID is required" },
        { status: 400 },
      );
    }

    // Check if already favorited
    const existing = await sql`
      SELECT id FROM user_favorites 
      WHERE user_id = ${userId} AND product_id = ${product_id}
    `;

    if (existing.length > 0) {
      return Response.json(
        { error: "Product already in favorites" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO user_favorites (user_id, product_id)
      VALUES (${userId}, ${product_id})
      RETURNING id
    `;

    return Response.json({
      success: true,
      favorite_id: result[0].id,
      message: "Added to favorites",
    });
  } catch (error) {
    console.error("Error adding to favorites:", error);
    return Response.json(
      { error: "Failed to add to favorites" },
      { status: 500 },
    );
  }
}

// DELETE - Remove from favorites
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get("product_id");

    const userId = await resolveUserId(request);

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!product_id) {
      return Response.json(
        { error: "Product ID is required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM user_favorites 
      WHERE user_id = ${userId} AND product_id = ${product_id}
    `;

    return Response.json({
      success: true,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Error removing from favorites:", error);
    return Response.json(
      { error: "Failed to remove from favorites" },
      { status: 500 },
    );
  }
}
