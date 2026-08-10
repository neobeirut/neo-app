import sql from "../../utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query || query.length < 2) {
      return Response.json({ customers: [] });
    }

    const pattern = `%${query}%`;

    const customers = await sql`
      WITH combined AS (
        SELECT 
          name as customer_name,
          phone as customer_phone,
          NULL as delivery_address,
          created_at
        FROM auth_users
        WHERE (name ILIKE ${pattern} OR phone ILIKE ${pattern})

        UNION ALL

        SELECT 
          customer_name,
          customer_phone,
          delivery_address,
          created_at
        FROM orders
        WHERE (customer_name ILIKE ${pattern} OR customer_phone ILIKE ${pattern})
          AND (customer_name IS NOT NULL AND customer_name != '')
      )
      SELECT DISTINCT ON (LOWER(COALESCE(NULLIF(customer_phone, ''), customer_name)))
        customer_name,
        customer_phone,
        delivery_address
      FROM combined
      ORDER BY LOWER(COALESCE(NULLIF(customer_phone, ''), customer_name)), created_at DESC
      LIMIT 10
    `;

    return Response.json({ customers: customers || [] });
  } catch (error) {
    console.error("Error in GET /api/pos/customers:", error);
    return Response.json(
      { error: "Failed to search customers: " + error.message },
      { status: 500 }
    );
  }
}
