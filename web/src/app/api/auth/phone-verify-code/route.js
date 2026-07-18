import sql from "@/app/api/utils/sql";

// Apple Review Test Account - same constants as phone-send-code
const APPLE_REVIEW_TEST_PHONE = "+9611234567";
const APPLE_REVIEW_TEST_CODE = "123456";

const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\s+/g, " ").trim();
};

// Must match the canonicalization in phone-send-code
const toLebanonE164 = (phone) => {
  const trimmed = normalizePhone(phone);
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

const normalizeCode = (code) => {
  if (code === null || code === undefined) return "";
  return String(code).replace(/\D/g, "").trim();
};

export async function POST(request) {
  try {
    const body = await request.json();
    const phoneRaw = normalizePhone(body?.phone);
    const code = normalizeCode(body?.code);

    if (!phoneRaw || !code) {
      return Response.json(
        { error: "Phone and code are required" },
        { status: 400 },
      );
    }

    const phone = toLebanonE164(phoneRaw); // canonical

    // Check the local DB table for OTP codes
    const result = await sql`
      SELECT code, expires_at
      FROM phone_verification_codes
      WHERE phone = ${phone}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return Response.json(
        { error: "No verification code found. Please request a new code." },
        { status: 400 },
      );
    }

    const storedCode = normalizeCode(result[0].code);
    const expiresAt = result[0].expires_at;

    if (new Date() > new Date(expiresAt)) {
      await sql`
        DELETE FROM phone_verification_codes
        WHERE phone = ${phone}
      `;
      return Response.json(
        { error: "Verification code has expired" },
        { status: 400 },
      );
    }

    if (code !== storedCode) {
      return Response.json(
        { error: "Invalid verification code" },
        { status: 400 },
      );
    }

    // Verified successfully - clear the code
    await sql`
      DELETE FROM phone_verification_codes
      WHERE phone = ${phone}
    `;

    return Response.json({
      success: true,
      verified: true,
      message: "Phone number verified successfully",
    });
  } catch (error) {
    console.error("Error verifying code:", error);
    return Response.json(
      { error: error?.message || "Failed to verify code" },
      { status: 500 },
    );
  }
}
