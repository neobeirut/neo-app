import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const rewards = await sql`
      SELECT * FROM rewards 
      WHERE is_active = true 
      ORDER BY points_cost
    `;

    return corsJson(request, { rewards });
  } catch (error) {
    console.error("Error fetching rewards:", error);
    return corsJson(
      request,
      { error: "Failed to fetch rewards" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      title,
      description,
      points_cost,
      image_url,
      is_active = true,
      discount_amount,
      free_delivery = false,
    } = await request.json();

    if (!title || !points_cost) {
      return corsJson(
        request,
        { error: "title and points_cost are required" },
        { status: 400 },
      );
    }

    const discountValueRaw =
      discount_amount === null || discount_amount === undefined
        ? null
        : Number.parseFloat(discount_amount);

    const discountValue =
      discountValueRaw === null
        ? null
        : Number.isFinite(discountValueRaw)
          ? Math.max(discountValueRaw, 0)
          : null;

    const [reward] = await sql`
      INSERT INTO rewards (
        title,
        description,
        points_cost,
        image_url,
        is_active,
        discount_amount,
        free_delivery
      )
      VALUES (
        ${title},
        ${description || ""},
        ${points_cost},
        ${image_url || ""},
        ${is_active},
        ${discountValue},
        ${free_delivery}
      )
      RETURNING *
    `;

    return corsJson(request, { reward });
  } catch (error) {
    console.error("Error creating reward:", error);
    return corsJson(
      request,
      { error: "Failed to create reward" },
      { status: 500 },
    );
  }
}
