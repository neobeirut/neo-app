import sql from "@/app/api/utils/sql";

// Apple Review Test Account - same constant as other auth endpoints
const APPLE_REVIEW_TEST_PHONE = "+9611234567";

// Keep phone storage consistent with OTP (+961...) and cart/user resolution.
const normalizePhoneForLookup = (phone) => {
  if (!phone) return "";
  return String(phone)
    .trim()
    .replace(/[^0-9+]/g, "");
};

// Canonicalize to Lebanese E.164 (+961...) to reduce duplicates from formatting.
const toLebanonE164 = (phone) => {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return "";

  // Remove ALL spaces/formatting first for test account check
  const digitsOnly = trimmed.replace(/\s+/g, "");

  // Allow Apple review test phone to bypass Lebanese validation
  if (digitsOnly === APPLE_REVIEW_TEST_PHONE) {
    return APPLE_REVIEW_TEST_PHONE;
  }

  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("9610")) {
    digits = `961${digits.slice(4)}`;
  }

  if (
    !digits.startsWith("961") &&
    digits.startsWith("0") &&
    digits.length === 8
  ) {
    digits = `961${digits.slice(1)}`;
  }

  if (!digits.startsWith("961") && digits.length >= 7 && digits.length <= 8) {
    digits = `961${digits}`;
  }

  const e164 = `+${digits}`;

  if (!e164.startsWith("+961")) {
    throw new Error("Only Lebanese phone numbers (+961) are supported.");
  }

  const rest = e164.replace("+961", "");
  const restLen = rest.length;
  if (restLen < 7 || restLen > 8 || rest.startsWith("0")) {
    throw new Error(
      "Invalid Lebanese phone number. Please enter your number without the leading 0 after +961 (example: +961 3 123456).",
    );
  }

  return e164;
};

export async function POST(request) {
  try {
    const {
      phone: phoneRaw,
      firstName,
      lastName,
      birthday,
    } = (await request.json()) || {};

    if (!phoneRaw || !firstName || !lastName || !birthday) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const canonicalPhone = toLebanonE164(phoneRaw);
    const phoneLookup = normalizePhoneForLookup(canonicalPhone);

    // Check if phone number already exists (any formatting) and is active
    // Exclude deleted accounts (phone IS NULL or is_active = false)
    const existingUser = await sql(
      `SELECT id, is_active
       FROM auth_users
       WHERE phone IS NOT NULL 
       AND is_active = true
       AND regexp_replace(phone, '[^0-9+]', '', 'g') = $1
       ORDER BY id DESC
       LIMIT 1`,
      [phoneLookup],
    );

    if (existingUser.length > 0) {
      return Response.json(
        { error: "Phone number already registered" },
        { status: 400 },
      );
    }

    // Create new user with canonical phone
    const newUser = await sql`
      INSERT INTO auth_users (phone, first_name, last_name, birthday, name, is_active)
      VALUES (${canonicalPhone}, ${firstName}, ${lastName}, ${birthday}, ${
        firstName + " " + lastName
      }, true)
      RETURNING id, phone, first_name, last_name, birthday, name, points, membership_tier
    `;

    return Response.json({
      success: true,
      user: newUser[0],
    });
  } catch (error) {
    console.error("Phone signup error:", error);
    return Response.json(
      { error: error?.message || "Failed to create account" },
      { status: 500 },
    );
  }
}
