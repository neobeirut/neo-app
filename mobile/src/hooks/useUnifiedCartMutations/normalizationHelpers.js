export const normalizeCustomizations = (customizations) => {
  const list = Array.isArray(customizations) ? customizations : [];

  return list
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
};

export const normalizeComment = (comment) => {
  return comment === null || comment === undefined
    ? null
    : String(comment).trim() || null;
};

export const extractAddonIdsFromItem = (item) => {
  const list = Array.isArray(item?.addons) ? item.addons : [];

  // Server items: { addon_id, name, price }
  // Local items may include: { addon_id } or { id }
  const ids = list
    .map((a) => Number(a?.addon_id ?? a?.id ?? a?.product_addon_id))
    .filter((x) => Number.isFinite(x));

  return Array.from(new Set(ids)).sort((a, b) => a - b);
};
