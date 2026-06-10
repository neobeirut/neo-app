export function normalizePromoCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

export function coerceJsonArray(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function coerceIdSet(list) {
  const arr = coerceJsonArray(list);
  if (!arr) return null;

  const set = new Set();
  for (const x of arr) {
    const asNum = Number(x);
    if (Number.isFinite(asNum)) {
      set.add(String(Math.trunc(asNum)));
    } else if (x !== null && x !== undefined && String(x).trim()) {
      set.add(String(x).trim());
    }
  }

  return set.size > 0 ? set : null;
}

export function calcPromoDiscount({ promo, eligibleSubtotal }) {
  const type = String(promo?.discount_type || "");
  const discountValue = Number(promo?.discount_value || 0);

  const maxDiscountRaw = promo?.max_discount;
  const maxDiscount =
    maxDiscountRaw === null || maxDiscountRaw === undefined
      ? null
      : Number(maxDiscountRaw);

  if (eligibleSubtotal <= 0) return 0;

  let discount = 0;
  if (type === "percent") {
    discount = (eligibleSubtotal * discountValue) / 100;
  } else if (type === "fixed") {
    discount = discountValue;
  }

  if (!Number.isFinite(discount) || discount <= 0) return 0;

  discount = Math.min(discount, eligibleSubtotal);

  if (
    maxDiscount !== null &&
    Number.isFinite(maxDiscount) &&
    maxDiscount >= 0
  ) {
    discount = Math.min(discount, maxDiscount);
  }

  return Math.round(discount * 100) / 100;
}
