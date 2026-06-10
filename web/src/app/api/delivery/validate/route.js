import { corsJson, corsOptions } from "@/app/api/utils/cors";
import {
  validateDeliveryForCoords,
  validateDeliveryForCoordsForBranch,
} from "@/app/api/utils/deliveryZone";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, branch_id } = body || {};

    // If a branch is provided, validate ONLY against that branch.
    // We still return `nearest` (global) as extra info, but UI should use `branch`.
    if (branch_id !== null && branch_id !== undefined) {
      const scoped = await validateDeliveryForCoordsForBranch({
        latitude,
        longitude,
        branchId: branch_id,
      });

      const global = await validateDeliveryForCoords({ latitude, longitude });

      return corsJson(request, {
        ok: scoped.ok,
        isDeliverable: scoped.isDeliverable,
        reason: scoped.reason,
        branch: scoped.branch
          ? {
              id: scoped.branch.id,
              name: scoped.branch.name,
              distanceKm:
                scoped.branch.distanceKm === null ||
                scoped.branch.distanceKm === undefined
                  ? null
                  : Number(scoped.branch.distanceKm.toFixed(3)),
              deliveryRadiusKm: Number(scoped.branch.deliveryRadiusKm),
            }
          : null,
        nearest: global.nearest
          ? {
              id: global.nearest.id,
              name: global.nearest.name,
              distanceKm: Number(global.nearest.distanceKm.toFixed(3)),
              deliveryRadiusKm: Number(global.nearest.deliveryRadiusKm),
            }
          : null,
      });
    }

    // Backwards-compatible: validate against ALL branches
    const result = await validateDeliveryForCoords({ latitude, longitude });

    return corsJson(request, {
      ok: result.ok,
      isDeliverable: result.isDeliverable,
      reason: result.reason,
      branch: null,
      nearest: result.nearest
        ? {
            id: result.nearest.id,
            name: result.nearest.name,
            distanceKm: Number(result.nearest.distanceKm.toFixed(3)),
            deliveryRadiusKm: Number(result.nearest.deliveryRadiusKm),
          }
        : null,
    });
  } catch (error) {
    console.error("[delivery/validate] error:", error);
    return corsJson(
      request,
      { ok: false, error: "Failed to validate delivery zone" },
      { status: 500 },
    );
  }
}
