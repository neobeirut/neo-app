import sql from "@/app/api/utils/sql";

// Phone normalization - must match phone-verify-code route
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

async function tryGetToken(request, raw) {
  let getToken;
  try {
    ({ getToken } = await import("@auth/core/jwt"));
  } catch (e) {
    console.error("[/api/auth/token] dynamic import @auth/core/jwt failed:", e);
    return null;
  }

  try {
    // Ensure AUTH_SECRET is a clean string
    let rawSecret = process.env.AUTH_SECRET;
    if (Buffer.isBuffer(rawSecret)) {
      rawSecret = rawSecret.toString("utf-8");
    }
    if (Array.isArray(rawSecret)) {
      rawSecret = rawSecret.join("");
    }
    if (typeof rawSecret === "object" && rawSecret !== null) {
      rawSecret = JSON.stringify(rawSecret);
    }
    const cleanSecret = `${String(rawSecret || "").trim()}`;

    // Convert to Uint8Array for JWT decoding (same as encoding)
    const secretBytes = new TextEncoder().encode(cleanSecret);

    return await getToken({
      req: request,
      secret: secretBytes,
      secureCookie: String(process.env.AUTH_URL || "").startsWith("https"),
      ...(raw ? { raw: true } : {}),
    });
  } catch (e) {
    console.error("[/api/auth/token] getToken error:", e);
    return null;
  }
}

export async function GET(request) {
  const [token, jwt] = await Promise.all([
    tryGetToken(request, true),
    tryGetToken(request, false),
  ]);

  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Fetch full user data including phone number from database
  const userResult = await sql`
    SELECT id, email, name, phone, points, membership_tier, total_spent, role
    FROM auth_users
    WHERE id = ${jwt.sub}
  `;

  const userData = userResult.length > 0 ? userResult[0] : null;

  return new Response(
    JSON.stringify({
      jwt: token,
      user: {
        id: jwt.sub,
        email: jwt.email,
        name: jwt.name,
        phone: userData?.phone || null,
        points: userData?.points || 0,
        membership_tier: userData?.membership_tier || "Bronze",
        total_spent: userData?.total_spent || 0,
        role: userData?.role || "customer",
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

// POST handler for phone-based authentication
export async function POST(request) {
  console.log("=".repeat(80));
  console.log("[/api/auth/token POST] 🔍 AUTHENTICATION REQUEST STARTED");
  console.log("[/api/auth/token POST] Time:", new Date().toISOString());
  console.log("[/api/auth/token POST] Environment Check:");
  console.log("  - AUTH_SECRET exists:", !!process.env.AUTH_SECRET);
  console.log("  - AUTH_SECRET length:", process.env.AUTH_SECRET?.length || 0);
  console.log("  - AUTH_URL:", process.env.AUTH_URL);
  console.log("  - DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("  - NODE_ENV:", process.env.NODE_ENV);

  try {
    console.log("[/api/auth/token POST] Step 1: Parsing request body");
    const body = await request.json();
    const phoneRaw = body?.phone;

    console.log("[/api/auth/token POST] Step 1 Complete:");
    console.log("  - Body keys:", Object.keys(body));
    console.log("  - Phone received:", phoneRaw);
    console.log("  - Phone type:", typeof phoneRaw);

    if (!phoneRaw) {
      console.log("[/api/auth/token POST] ❌ ERROR: No phone provided");
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Normalize phone to canonical E.164 format (same as verification flow)
    console.log("[/api/auth/token POST] Step 2: Normalizing phone number");
    let canonicalPhone;
    try {
      canonicalPhone = toLebanonE164(phoneRaw);
      console.log("[/api/auth/token POST] Step 2 Complete:");
      console.log("  - Original phone:", phoneRaw);
      console.log("  - Canonical phone:", canonicalPhone);
    } catch (error) {
      console.log(
        "[/api/auth/token POST] ❌ ERROR: Phone normalization failed",
      );
      console.log("  - Error message:", error.message);
      console.log("  - Error stack:", error.stack);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Query database with canonical phone
    console.log("[/api/auth/token POST] Step 3: Querying database");
    console.log("  - Query phone:", canonicalPhone);

    const userResult = await sql`
      SELECT id, email, name, phone, points, membership_tier, total_spent, role, is_active
      FROM auth_users
      WHERE phone = ${canonicalPhone}
        AND is_active = true
      ORDER BY ID DESC
      LIMIT 1
    `;

    console.log("[/api/auth/token POST] Step 3 Complete:");
    console.log("  - Query result count:", userResult.length);

    if (userResult.length > 0) {
      console.log("  - User found:");
      console.log("    * ID:", userResult[0].id);
      console.log("    * Email:", userResult[0].email);
      console.log("    * Name:", userResult[0].name);
      console.log("    * Phone:", userResult[0].phone);
      console.log("    * Active:", userResult[0].is_active);
    }

    if (userResult.length === 0) {
      console.log("[/api/auth/token POST] ❌ ERROR: User not found");
      console.log("  - Searched phone:", canonicalPhone);

      // Debug: Let's see what phones exist in the database
      console.log(
        "[/api/auth/token POST] 🔍 DEBUG: Checking database for similar phones",
      );
      const allPhones = await sql`
        SELECT id, phone, is_active, email 
        FROM auth_users 
        WHERE is_active = true 
        ORDER BY id DESC
        LIMIT 10
      `;
      console.log("  - Sample active users in database:");
      allPhones.forEach((p) => {
        console.log(`    * ID: ${p.id}, Phone: ${p.phone}, Email: ${p.email}`);
      });

      return new Response(
        JSON.stringify({
          error:
            "No account found with this phone number. Please sign up first.",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const user = userResult[0];
    console.log("[/api/auth/token POST] Step 4: User validated successfully");

    // Import JWT encode function
    console.log("[/api/auth/token POST] Step 5: Importing JWT library");
    let encode;
    try {
      ({ encode } = await import("@auth/core/jwt"));
      console.log(
        "[/api/auth/token POST] Step 5 Complete: JWT library imported",
      );
    } catch (e) {
      console.error(
        "[/api/auth/token POST] ❌ ERROR: Failed to import @auth/core/jwt",
      );
      console.error("  - Error:", e);
      console.error("  - Error stack:", e.stack);
      return new Response(
        JSON.stringify({ error: "Authentication system error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check and validate AUTH_SECRET
    console.log("[/api/auth/token POST] Step 6: Validating AUTH_SECRET");
    console.log("  - AUTH_SECRET exists:", !!process.env.AUTH_SECRET);
    console.log("  - AUTH_SECRET type:", typeof process.env.AUTH_SECRET);
    console.log(
      "  - AUTH_SECRET constructor:",
      process.env.AUTH_SECRET?.constructor?.name,
    );
    console.log(
      "  - AUTH_SECRET is Buffer?:",
      Buffer.isBuffer(process.env.AUTH_SECRET),
    );
    console.log(
      "  - AUTH_SECRET is Array?:",
      Array.isArray(process.env.AUTH_SECRET),
    );
    console.log("  - AUTH_SECRET raw value:", process.env.AUTH_SECRET);

    if (!process.env.AUTH_SECRET) {
      console.error(
        "[/api/auth/token POST] ❌ CRITICAL: AUTH_SECRET is not set!",
      );
      return new Response(
        JSON.stringify({ error: "Authentication configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Ensure AUTH_SECRET is a proper string with detailed logging
    console.log("  - Attempting to convert AUTH_SECRET to string...");
    let authSecret;
    try {
      // Handle different possible formats of AUTH_SECRET
      let rawSecret = process.env.AUTH_SECRET;

      // If it's a Buffer, convert to string
      if (Buffer.isBuffer(rawSecret)) {
        console.log("  - AUTH_SECRET is a Buffer, converting...");
        rawSecret = rawSecret.toString("utf-8");
      }

      // If it's an array, join it
      if (Array.isArray(rawSecret)) {
        console.log("  - AUTH_SECRET is an Array, joining...");
        rawSecret = rawSecret.join("");
      }

      // If it's an object (but not null), try to stringify
      if (typeof rawSecret === "object" && rawSecret !== null) {
        console.log("  - AUTH_SECRET is an Object, stringifying...");
        rawSecret = JSON.stringify(rawSecret);
      }

      // Convert to string and trim
      authSecret = String(rawSecret).trim();

      // Create a new clean string instance to avoid any prototype issues
      authSecret = `${authSecret}`;

      console.log("  - String conversion successful!");
      console.log("  - Converted type:", typeof authSecret);
      console.log("  - Converted length:", authSecret.length);
      console.log("  - First 20 chars:", authSecret.substring(0, 20));
      console.log(
        "  - Last 20 chars:",
        authSecret.substring(authSecret.length - 20),
      );
      console.log(
        "  - Contains special chars?:",
        /[^a-zA-Z0-9]/.test(authSecret),
      );
      console.log("  - Is primitive string?:", typeof authSecret === "string");
      console.log(
        "  - String check passed:",
        authSecret instanceof String || typeof authSecret === "string",
      );
    } catch (e) {
      console.error("  - ❌ ERROR during String conversion:", e);
      throw e;
    }

    if (
      !authSecret ||
      authSecret === "undefined" ||
      authSecret === "null" ||
      authSecret.length === 0
    ) {
      console.error(
        "[/api/auth/token POST] ❌ CRITICAL: AUTH_SECRET is invalid!",
      );
      console.error("  - Value:", authSecret);
      return new Response(
        JSON.stringify({
          error: "Authentication configuration error - invalid secret",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create JWT token (not a database session)
    console.log("[/api/auth/token POST] Step 7: Creating JWT token");
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    console.log("  - Token payload:");
    console.log("    * sub:", String(user.id));
    console.log("    * email:", user.email);
    console.log("    * name:", user.name);
    console.log("    * phone:", user.phone);
    console.log("  - Max age:", maxAge, "seconds");
    console.log("  - Secret being passed to encode:");
    console.log("    * Type:", typeof authSecret);
    console.log("    * Length:", authSecret.length);
    console.log("    * Is string?:", typeof authSecret === "string");
    console.log("    * Constructor:", authSecret.constructor.name);

    // Convert secret to Uint8Array for JWT encoding
    console.log("  - Converting secret to Uint8Array...");
    const secretBytes = new TextEncoder().encode(authSecret);
    console.log("    * Converted to Uint8Array");
    console.log("    * Byte length:", secretBytes.length);
    console.log("    * Type:", secretBytes.constructor.name);

    let token;
    try {
      console.log("  - Calling encode function...");
      token = await encode({
        token: {
          sub: String(user.id),
          email: user.email,
          name: user.name,
          phone: user.phone,
        },
        secret: secretBytes,
        maxAge,
      });
      console.log("  - encode() returned successfully!");
      console.log("[/api/auth/token POST] Step 7 Complete: JWT token created");
      console.log("  - Token length:", token?.length || 0);
      console.log("  - Token type:", typeof token);
    } catch (e) {
      console.error(
        "[/api/auth/token POST] ❌ ERROR: Failed to create JWT token",
      );
      console.error("  - Error name:", e.name);
      console.error("  - Error message:", e.message);
      console.error("  - Error stack:", e.stack);
      console.error("  - Secret type used:", typeof secretBytes);
      console.error("  - Secret byte length:", secretBytes.length);
      console.error(
        "  - Full error object:",
        JSON.stringify(e, Object.getOwnPropertyNames(e)),
      );
      throw e;
    }

    // Set cookie with JWT token (NOT a session token UUID)
    console.log("[/api/auth/token POST] Step 8: Setting authentication cookie");
    const isSecure = String(process.env.AUTH_URL || "").startsWith("https");
    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    console.log("  - Cookie name:", cookieName);
    console.log("  - Is secure:", isSecure);
    console.log("  - Max age:", maxAge);

    const cookie = `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure ? "; Secure" : ""}`;

    console.log("[/api/auth/token POST] Step 8 Complete: Cookie prepared");
    console.log("=".repeat(80));
    console.log("[/api/auth/token POST] ✅ AUTHENTICATION SUCCESSFUL");
    console.log("  - User ID:", user.id);
    console.log("  - User Email:", user.email);
    console.log("  - User Name:", user.name);
    console.log("=".repeat(80));

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          points: user.points || 0,
          membership_tier: user.membership_tier || "Bronze",
          total_spent: user.total_spent || 0,
          role: user.role || "customer",
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie,
        },
      },
    );
  } catch (error) {
    console.log("=".repeat(80));
    console.error("[/api/auth/token POST] ❌ FATAL ERROR in authentication");
    console.error("  - Error name:", error.name);
    console.error("  - Error message:", error.message);
    console.error("  - Error stack:", error.stack);
    console.error("  - Error details:", JSON.stringify(error, null, 2));
    console.log("=".repeat(80));
    return new Response(
      JSON.stringify({
        error: "Failed to authenticate",
        details: error.message,
        errorType: error.name,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
