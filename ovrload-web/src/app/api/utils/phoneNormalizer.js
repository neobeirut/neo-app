/**
 * Universal Phone Number Normalizer
 * Normalizes any phone number into international E.164 format (+961...)
 * Handles:
 * - Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹)
 * - Leading zeros and double-zero (00) international prefixes
 * - Domestic Lebanese prefixes (03, 70, 71, 76, 81, 01, etc.)
 * - 7 or 8 digit local numbers without leading 0
 * - International numbers (+1, +33, +971, +44, etc.)
 */

export function normalizePhoneE164(input) {
  if (!input) return "";

  // 1. Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII
  let normalized = String(input)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

  // 2. Check if original input already had a '+' prefix
  const hasPlus = normalized.trim().startsWith("+");

  // 3. Strip all non-digit characters
  let digits = normalized.replace(/\D/g, "");
  if (!digits) return "";

  // 4. Strip international prefix '00'
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // 5. Handle numbers starting with Lebanese country code 961
  if (digits.startsWith("961")) {
    let rest = digits.slice(3);
    // Remove domestic leading zero if entered as +961 03 xxx xxx or +961 070 xxx xxx
    if (rest.startsWith("0")) {
      rest = rest.slice(1);
    }
    return `+961${rest}`;
  }

  // 6. Handle domestic Lebanese numbers starting with 0 (e.g. 03..., 070..., 071..., 076..., 081..., 01..., 04...)
  if (digits.startsWith("0")) {
    return `+961${digits.slice(1)}`;
  }

  // 7. Handle 7 or 8 digit local Lebanese numbers (e.g. 3123456, 70123456, 71123456, 81123456)
  if (!hasPlus && (digits.length === 7 || digits.length === 8)) {
    return `+961${digits}`;
  }

  // 8. General international number
  return `+${digits}`;
}

/**
 * Format recipient phone number for Infobip (digits only without '+' prefix)
 */
export function toInfobipRecipient(phone) {
  const e164 = normalizePhoneE164(phone);
  if (e164.startsWith("+")) {
    return e164.slice(1);
  }
  return e164;
}

/**
 * Validate phone number format
 */
export function isValidE164(phone) {
  if (!phone) return false;
  return /^\+[1-9]\d{6,14}$/.test(String(phone).trim());
}

export const normalizePhoneNumber = normalizePhoneE164;

export function formatPhoneDisplay(phone) {
  const e164 = normalizePhoneE164(phone);
  if (!e164) return "";
  if (e164.startsWith("+961")) {
    const local = e164.slice(4);
    if (local.length === 7) {
      return `+961 ${local.slice(0, 1)} ${local.slice(1, 4)} ${local.slice(4)}`;
    }
    if (local.length === 8) {
      return `+961 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
    }
  }
  return e164;
}
