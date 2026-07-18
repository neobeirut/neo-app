// Normalize to digits only so "+961 ..." and "961..." match.
export const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^0-9]/g, "");
  return cleaned || null;
};
