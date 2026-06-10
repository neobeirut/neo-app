import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

export async function GET() {
  try {
    const result = await sql`
      SELECT setting_value 
      FROM app_settings 
      WHERE setting_key = 'delivery_cost'
    `;

    const deliveryCost = result[0]?.setting_value || "3.99";

    return Response.json({ delivery_cost: parseFloat(deliveryCost) });
  } catch (error) {
    console.error("Error fetching delivery cost:", error);
    return Response.json({ delivery_cost: 3.99 });
  }
}

export async function PUT(request) {
  try {
    // Allow either a regular user session OR the lightweight admin header auth
    const session = await auth();
    const admin = session ? null : await getAdminFromRequest(request);

    if (!session && !admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { delivery_cost } = await request.json();

    if (!delivery_cost || isNaN(delivery_cost) || delivery_cost < 0) {
      return Response.json({ error: "Invalid delivery cost" }, { status: 400 });
    }

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('delivery_cost', ${delivery_cost.toString()}, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET 
        setting_value = ${delivery_cost.toString()},
        updated_at = CURRENT_TIMESTAMP
    `;

    return Response.json({
      success: true,
      delivery_cost: parseFloat(delivery_cost),
    });
  } catch (error) {
    console.error("Error updating delivery cost:", error);
    return Response.json(
      { error: "Failed to update delivery cost" },
      { status: 500 },
    );
  }
}
