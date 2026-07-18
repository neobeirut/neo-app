import sql from "@/app/api/utils/sql";

// Phone normalization - must match phone-verify-code and token routes
const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\s+/g, " ").trim();
};

const toLebanonE164 = (phone) => {
  const trimmed = normalizePhone(phone);
  if (!trimmed) return "";

  // Remove ALL spaces/formatting first
  const digitsOnly = trimmed.replace(/\s+/g, "");

  // Apple review test phone
  if (digitsOnly === "+9611234567") {
    return "+9611234567";
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
    const body = await request.json();
    const phoneRaw = body?.phone;

    if (!phoneRaw) {
      return Response.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    // Normalize to canonical E.164 format
    let canonicalPhone;
    try {
      canonicalPhone = toLebanonE164(phoneRaw);
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    // Look up user with canonical phone
    const user = await sql`
      SELECT 
        id,
        phone,
        first_name,
        last_name,
        birthday,
        name,
        points,
        membership_tier,
        total_spent,
        role,
        is_active
      FROM auth_users
      WHERE phone = ${canonicalPhone}
        AND is_active = true
      ORDER BY id DESC
      LIMIT 1
    `;

    if (user.length === 0) {
      return Response.json({ exists: false });
    }

    return Response.json({
      exists: true,
      user: user[0],
    });
  } catch (error) {
    console.error("Phone verify error:", error);
    return Response.json({ error: "Failed to verify phone" }, { status: 500 });
  }
}
