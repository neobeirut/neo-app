import sql from "@/app/api/utils/sql";

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseLatLngFromBranchLocation(location) {
  if (!location) return null;
  const raw = String(location).trim();

  // common formats: "33.89,35.50" OR "33.89 35.50"
  const parts = raw.includes(",")
    ? raw.split(",")
    : raw.split(/\s+/).filter(Boolean);

  if (parts.length < 2) return null;

  const lat = toNumber(parts[0]);
  const lng = toNumber(parts[1]);

  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { latitude: lat, longitude: lng };
}

// NEW: validate delivery for a specific branch only (do not auto-switch branches)
export async function validateDeliveryForCoordsForBranch({
  latitude,
  longitude,
  branchId,
}) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  const bid = toNumber(branchId);

  if (lat === null || lng === null) {
    return {
      ok: false,
      isDeliverable: false,
      reason: "MISSING_COORDS",
      branch: null,
    };
  }

  if (bid === null) {
    return {
      ok: false,
      isDeliverable: false,
      reason: "MISSING_BRANCH_ID",
      branch: null,
    };
  }

  const [b] = await sql`
    SELECT id, name, location, delivery_radius_km, is_active
    FROM branches
    WHERE id = ${bid}
    LIMIT 1
  `;

  if (!b || b.is_active !== true) {
    return {
      ok: true,
      isDeliverable: false,
      reason: "BRANCH_NOT_FOUND",
      branch: null,
    };
  }

  const coords = parseLatLngFromBranchLocation(b.location);
  if (!coords) {
    return {
      ok: true,
      isDeliverable: false,
      reason: "BRANCH_MISSING_COORDS",
      branch: {
        id: b.id,
        name: b.name,
        distanceKm: null,
        deliveryRadiusKm: toNumber(b.delivery_radius_km) ?? 0,
      },
    };
  }

  const radius = toNumber(b.delivery_radius_km) ?? 0;
  const distanceKm = haversineDistanceKm(
    lat,
    lng,
    coords.latitude,
    coords.longitude,
  );

  const withinRadius = distanceKm <= radius;

  return {
    ok: true,
    isDeliverable: withinRadius,
    reason: withinRadius ? null : "OUT_OF_RANGE",
    branch: {
      id: b.id,
      name: b.name,
      distanceKm,
      deliveryRadiusKm: radius,
    },
  };
}

export async function validateDeliveryForCoords({ latitude, longitude }) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  if (lat === null || lng === null) {
    return {
      ok: false,
      isDeliverable: false,
      reason: "MISSING_COORDS",
      nearest: null,
      candidates: [],
    };
  }

  const branches = await sql`
    SELECT id, name, location, delivery_radius_km, is_active
    FROM branches
    WHERE is_active = true
    ORDER BY name
  `;

  const candidates = [];

  for (const b of branches) {
    const coords = parseLatLngFromBranchLocation(b.location);
    if (!coords) {
      continue;
    }

    const radius = toNumber(b.delivery_radius_km) ?? 0;
    const distanceKm = haversineDistanceKm(
      lat,
      lng,
      coords.latitude,
      coords.longitude,
    );

    candidates.push({
      id: b.id,
      name: b.name,
      distanceKm,
      deliveryRadiusKm: radius,
      withinRadius: distanceKm <= radius,
    });
  }

  const deliverable = candidates
    .filter((c) => c.withinRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (deliverable.length === 0) {
    return {
      ok: true,
      isDeliverable: false,
      reason: "OUT_OF_RANGE",
      nearest: null,
      candidates,
    };
  }

  const nearest = deliverable[0];

  return {
    ok: true,
    isDeliverable: true,
    reason: null,
    nearest,
    candidates,
  };
}
