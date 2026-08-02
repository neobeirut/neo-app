import {
  normalizeCustomizations,
  normalizeComment,
  extractAddonIdsFromItem,
} from "./normalizationHelpers";

export const getCartLineSignature = ({
  productId,
  customizations,
  selectedAddonIds,
  itemForAddonIds,
  comment,
}) => {
  const pid = Number(productId);
  const normalizedCustom = normalizeCustomizations(customizations);

  const addonIds = Array.isArray(selectedAddonIds)
    ? Array.from(
        new Set(
          selectedAddonIds
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x)),
        ),
      ).sort((a, b) => a - b)
    : extractAddonIdsFromItem(itemForAddonIds);

  const cmt = normalizeComment(comment);

  return JSON.stringify({
    product_id: pid,
    customizations: normalizedCustom,
    addon_ids: addonIds,
    comment: cmt,
  });
};
