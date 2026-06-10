import sql from "@/app/api/utils/sql";
import { validateDeliveryForCoordsForBranch } from "@/app/api/utils/deliveryZone";
import { corsJson } from "@/app/api/utils/cors";

export async function validateDeliveryAddress({
  request,
  order_type,
  address_id,
  userId,
  effectiveBranchId,
}) {
  if (order_type !== "delivery") {
    return { ok: true, deliveryValidation: null };
  }

  if (!address_id) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Delivery address is required",
          code: "DELIVERY_ADDRESS_REQUIRED",
        },
        { status: 400 },
      ),
    };
  }

  const [addr] = await sql`
    SELECT id, latitude, longitude
    FROM user_addresses
    WHERE id = ${address_id} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!addr) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Delivery address not found",
          code: "DELIVERY_ADDRESS_NOT_FOUND",
        },
        { status: 404 },
      ),
    };
  }

  if (addr.latitude === null || addr.longitude === null) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Delivery address is missing GPS coordinates",
          code: "DELIVERY_ADDRESS_MISSING_COORDS",
        },
        { status: 400 },
      ),
    };
  }

  const deliveryValidation = await validateDeliveryForCoordsForBranch({
    latitude: addr.latitude,
    longitude: addr.longitude,
    branchId: effectiveBranchId,
  });

  const validatedAt = deliveryValidation?.ok ? new Date() : null;

  if (!deliveryValidation?.ok) {
    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: "Could not validate delivery zone",
          code: "DELIVERY_VALIDATION_FAILED",
        },
        { status: 500 },
      ),
    };
  }

  if (!deliveryValidation.isDeliverable) {
    const branchName = deliveryValidation?.branch?.name || null;

    await sql`
      UPDATE user_addresses
      SET delivery_validated_at = ${validatedAt}
      WHERE id = ${address_id} AND user_id = ${userId}
    `;

    return {
      ok: false,
      response: corsJson(
        request,
        {
          error: branchName
            ? `This address isn't eligible for delivery from ${branchName}.`
            : "This address isn't eligible for delivery from the selected branch.",
          code: "DELIVERY_NOT_AVAILABLE_FOR_BRANCH",
          branch: deliveryValidation?.branch
            ? {
                id: deliveryValidation.branch.id,
                name: deliveryValidation.branch.name,
                distanceKm:
                  deliveryValidation.branch.distanceKm === null ||
                  deliveryValidation.branch.distanceKm === undefined
                    ? null
                    : Number(deliveryValidation.branch.distanceKm.toFixed(3)),
                deliveryRadiusKm: Number(
                  deliveryValidation.branch.deliveryRadiusKm,
                ),
              }
            : null,
        },
        { status: 400 },
      ),
    };
  }

  await sql`
    UPDATE user_addresses
    SET delivery_validated_at = ${validatedAt},
        assigned_branch_id = ${effectiveBranchId},
        delivery_distance_km = ${deliveryValidation?.branch?.distanceKm || null},
        is_deliverable = true
    WHERE id = ${address_id} AND user_id = ${userId}
  `;

  return { ok: true, deliveryValidation };
}
