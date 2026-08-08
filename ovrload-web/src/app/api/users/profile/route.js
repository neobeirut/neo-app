import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { validateDeliveryForCoords } from "@/app/api/utils/deliveryZone";

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
    console.error("[users/profile] dynamic import @auth/core/jwt failed:", e);
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
    console.error("[users/profile] getToken error:", e);
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

  const phoneNorm = normalizePhone(phoneRaw) || normalizePhone(headerPhoneRaw);

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

async function resolveUserIdFromBody(request) {
  const body = await request.json().catch(() => ({}));

  const headerPhoneRaw =
    request.headers.get("x-auth-phone") ||
    request.headers.get("X-Auth-Phone") ||
    request.headers.get("X-AUTH-PHONE");

  const phoneNorm =
    normalizePhone(body?.phone) || normalizePhone(headerPhoneRaw);

  const headerResolved = await resolveUserIdFromHeader(request, phoneNorm);
  if (headerResolved) return { userId: headerResolved, body };

  if (phoneNorm) {
    const rows = await sql(
      "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 AND is_active = true ORDER BY id DESC LIMIT 1",
      [phoneNorm],
    );
    if (rows.length > 0) return { userId: Number(rows[0].id), body };
  }

  const jwtUserId = await tryGetJwtUserId(request);
  if (jwtUserId) return { userId: jwtUserId, body };

  return { userId: null, body };
}

export async function GET(request) {
  try {
    const userId = await resolveUserId(request);

    if (!userId) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const user = await sql`
      SELECT 
        id,
        name,
        first_name,
        last_name,
        email,
        phone,
        role,
        points,
        membership_tier,
        total_spent,
        birthday
      FROM auth_users 
      WHERE id = ${userId}
    `;

    if (user.length === 0) {
      return corsJson(request, { error: "User not found" }, { status: 404 });
    }

    // Get user addresses (including building field)
    const addresses = await sql`
      SELECT * FROM user_addresses 
      WHERE user_id = ${userId}
      ORDER BY is_default DESC, created_at DESC
    `;

    return corsJson(request, {
      user: user[0],
      addresses: addresses,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const { userId, body } = await resolveUserIdFromBody(request);
    const { name, phone: phoneToUpdate, address } = body || {};

    if (!userId) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    // Update user basic info
    if (name !== undefined || phoneToUpdate !== undefined) {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (phoneToUpdate !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phoneToUpdate);
      }

      values.push(userId);

      if (updates.length > 0) {
        const updateSql = `
          UPDATE auth_users 
          SET ${updates.join(", ")}
          WHERE id = $${paramIndex}
        `;
        await sql(updateSql, values);
      }
    }

    let addressValidation = null;

    // Handle address update/creation
    if (address) {
      const {
        id,
        label,
        address_line1,
        building,
        company_name,
        address_line2,
        city,
        state,
        zip_code,
        latitude,
        longitude,
        is_default,
      } = address;

      const hasCoords =
        latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined;

      if (hasCoords) {
        addressValidation = await validateDeliveryForCoords({
          latitude,
          longitude,
        });
      }

      const validatedAt = addressValidation?.ok ? new Date() : null;

      const isDeliverable = addressValidation?.ok
        ? addressValidation.isDeliverable
        : null;

      const assignedBranchId =
        addressValidation?.ok && addressValidation.isDeliverable
          ? addressValidation.nearest?.id
          : null;

      const deliveryDistanceKm =
        addressValidation?.ok && addressValidation.isDeliverable
          ? addressValidation.nearest?.distanceKm
          : null;

      if (id) {
        // Update existing address
        await sql`
          UPDATE user_addresses 
          SET 
            label = ${label || ""},
            address_line1 = ${address_line1},
            building = ${building || ""},
            company_name = ${company_name || ""},
            address_line2 = ${address_line2 || ""},
            city = ${city},
            state = ${state},
            zip_code = ${zip_code || null},
            latitude = ${latitude || null},
            longitude = ${longitude || null},
            is_default = ${is_default || false},
            is_deliverable = ${isDeliverable},
            assigned_branch_id = ${assignedBranchId},
            delivery_distance_km = ${deliveryDistanceKm},
            delivery_validated_at = ${validatedAt},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${userId}
        `;
      } else {
        // Create new address
        // If this is set as default, unset other defaults first
        if (is_default) {
          await sql`
            UPDATE user_addresses 
            SET is_default = false 
            WHERE user_id = ${userId}
          `;
        }

        await sql`
          INSERT INTO user_addresses (
            user_id,
            label,
            address_line1,
            building,
            company_name,
            address_line2,
            city,
            state,
            zip_code,
            latitude,
            longitude,
            is_default,
            is_deliverable,
            assigned_branch_id,
            delivery_distance_km,
            delivery_validated_at
          ) VALUES (
            ${userId},
            ${label || ""},
            ${address_line1},
            ${building || ""},
            ${company_name || ""},
            ${address_line2 || ""}, 
            ${city},
            ${state},
            ${zip_code || null},
            ${latitude || null},
            ${longitude || null},
            ${is_default || false},
            ${isDeliverable},
            ${assignedBranchId},
            ${deliveryDistanceKm},
            ${validatedAt}
          )
        `;
      }
    }

    const publicValidation = addressValidation?.ok
      ? {
          isDeliverable: addressValidation.isDeliverable,
          reason: addressValidation.reason,
          nearest: addressValidation.nearest
            ? {
                id: addressValidation.nearest.id,
                name: addressValidation.nearest.name,
                distanceKm: Number(
                  addressValidation.nearest.distanceKm.toFixed(3),
                ),
                deliveryRadiusKm: Number(
                  addressValidation.nearest.deliveryRadiusKm,
                ),
              }
            : null,
        }
      : null;

    return corsJson(request, {
      success: true,
      message: "Profile updated successfully",
      ...(publicValidation ? { addressValidation: publicValidation } : {}),
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { userId, body } = await resolveUserIdFromBody(request);
    const { addressId } = body || {};

    if (!userId) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    if (!addressId) {
      return corsJson(
        request,
        { error: "Address ID required" },
        { status: 400 },
      );
    }

    // Check if this address is being used by any orders
    const ordersUsingAddress = await sql`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE address_id = ${addressId}
    `;

    if (ordersUsingAddress[0].count > 0) {
      return corsJson(
        request,
        {
          error:
            "This address cannot be deleted because it's associated with past orders. You can set a different address as default instead.",
        },
        { status: 400 },
      );
    }

    // Delete the address (only if it belongs to the user)
    await sql`
      DELETE FROM user_addresses 
      WHERE id = ${addressId} AND user_id = ${userId}
    `;

    return corsJson(request, {
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    return corsJson(
      request,
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
