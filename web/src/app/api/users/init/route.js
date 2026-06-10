import sql from "@/app/api/utils/sql";
import { hash } from "argon2";

// This endpoint creates a customer user for testing
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name, phone } = body;

    if (!email || !password || !name) {
      return Response.json(
        { error: "Email, password, and name are required" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM auth_users WHERE email = ${email}
    `;

    if (existing.length > 0) {
      return Response.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Hash the password
    const hashedPassword = await hash(password);

    // Create the user
    const result = await sql.transaction(async (txn) => {
      // Create auth_users entry
      const [user] = await txn`
        INSERT INTO auth_users (name, email, phone)
        VALUES (${name}, ${email}, ${phone || null})
        RETURNING id, name, email, phone
      `;

      // Create credentials account
      await txn`
        INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password)
        VALUES (${user.id}, 'credentials', 'credentials', ${user.id}, ${hashedPassword})
      `;

      return user;
    });

    return Response.json({
      user: result,
      message: "Customer account created successfully",
    });
  } catch (error) {
    console.error("Error creating customer user:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
