import { getBestCachedProductAddons } from "./productCacheHelpers";

export const buildAddonObjects = (queryClient, productId, selectedAddonIds) => {
  // IMPORTANT: normalize to stable, unique, sorted IDs so JSON.stringify comparisons are consistent
  const ids = Array.isArray(selectedAddonIds)
    ? Array.from(
        new Set(
          selectedAddonIds
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x)),
        ),
      ).sort((a, b) => a - b)
    : [];
  if (ids.length === 0) return [];

  const catalog = getBestCachedProductAddons(queryClient, productId);
  const byId = new Map(catalog.map((a) => [Number(a.id), a]));

  return ids
    .map((id) => {
      const row = byId.get(Number(id));
      if (!row) {
        return { addon_id: Number(id), name: "Add-on", price: 0 };
      }
      return {
        addon_id: Number(row.id),
        name: row.name,
        price: row.price,
      };
    })
    .filter(Boolean);
};
