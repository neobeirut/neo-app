import sql from "@/app/api/utils/sql";

// Apple Review Test Account credentials
const APPLE_REVIEW_TEST_PHONE = "+9611234567";
const APPLE_REVIEW_TEST_CODE = "123456";

export async function POST(request) {
  try {
    // Check if test account already exists
    const existingUser = await sql`
      SELECT id, phone, first_name, last_name, is_active
      FROM auth_users
      WHERE phone = ${APPLE_REVIEW_TEST_PHONE}
      LIMIT 1
    `;

    if (existingUser.length > 0 && existingUser[0].is_active) {
      return Response.json({
        success: true,
        message: "Apple Review test account already exists",
        user: existingUser[0],
      });
    }

    // Create the test account
    const testUser = await sql`
      INSERT INTO auth_users (
        phone,
        first_name,
        last_name,
        birthday,
        name,
        is_active,
        role,
        points,
        membership_tier,
        total_spent
      )
      VALUES (
        ${APPLE_REVIEW_TEST_PHONE},
        'Apple',
        'Reviewer',
        '1990-01-01',
        'Apple Reviewer',
        true,
        'customer',
        500,
        'Gold',
        100.00
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id, phone, first_name, last_name, name, points, membership_tier
    `;

    return Response.json({
      success: true,
      message: "Apple Review test account created successfully",
      user: testUser[0] || existingUser[0],
      credentials: {
        phone: APPLE_REVIEW_TEST_PHONE,
        code: APPLE_REVIEW_TEST_CODE,
        note: "This account bypasses all SMS/WhatsApp verification requirements",
      },
    });
  } catch (error) {
    console.error("Error initializing test account:", error);
    return Response.json(
      { error: error?.message || "Failed to initialize test account" },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  // GET endpoint to check if test account exists
  try {
    const existingUser = await sql`
      SELECT id, phone, first_name, last_name, is_active, points, membership_tier
      FROM auth_users
      WHERE phone = ${APPLE_REVIEW_TEST_PHONE}
      LIMIT 1
    `;

    if (existingUser.length === 0) {
      return Response.json({
        exists: false,
        message: "Test account does not exist. Call POST to create it.",
      });
    }

    return Response.json({
      exists: true,
      user: existingUser[0],
      credentials: {
        phone: APPLE_REVIEW_TEST_PHONE,
        code: APPLE_REVIEW_TEST_CODE,
      },
    });
  } catch (error) {
    console.error("Error checking test account:", error);
    return Response.json(
      { error: error?.message || "Failed to check test account" },
      { status: 500 },
    );
  }
}
