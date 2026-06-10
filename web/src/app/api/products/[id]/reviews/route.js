import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^0-9+]/g, "");
  return cleaned || null;
}

// Get reviews for a product
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const reviews = await sql`
      SELECT 
        pr.*,
        au.name as user_name
      FROM product_reviews pr
      JOIN auth_users au ON pr.user_id = au.id
      WHERE pr.product_id = ${id}
      ORDER BY pr.created_at DESC
    `;

    // Calculate average rating
    const avgRating = await sql`
      SELECT AVG(rating)::DECIMAL(3,2) as avg_rating, COUNT(*) as total_reviews
      FROM product_reviews 
      WHERE product_id = ${id}
    `;

    return Response.json({
      reviews,
      average_rating: avgRating[0]?.avg_rating || 0,
      total_reviews: avgRating[0]?.total_reviews || 0,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return Response.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

// Add a review for a product
export async function POST(request, { params }) {
  try {
    const session = await auth();
    const body = await request.json();
    const { rating, review_text } = body;
    const phone = normalizePhone(body?.phone);

    let userId;

    if (session?.user?.id) {
      userId = session.user.id;
    } else if (phone) {
      const user = await sql(
        "SELECT id FROM auth_users WHERE regexp_replace(phone, '[^0-9+]', '', 'g') = $1 AND is_active = true",
        [phone],
      );
      if (user.length === 0) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      userId = user[0].id;
    } else {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = params;

    if (!rating || rating < 1 || rating > 5) {
      return Response.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    // Insert or update review (using ON CONFLICT for unique constraint)
    const result = await sql`
      INSERT INTO product_reviews (product_id, user_id, rating, review_text)
      VALUES (${id}, ${userId}, ${rating}, ${review_text || ""})
      ON CONFLICT (product_id, user_id) 
      DO UPDATE SET 
        rating = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    // Update product average rating
    const avgResult = await sql`
      UPDATE products 
      SET rating = (
        SELECT AVG(rating)::DECIMAL(3,2) 
        FROM product_reviews 
        WHERE product_id = ${id}
      )
      WHERE id = ${id}
    `;

    return Response.json({
      message: "Review saved successfully",
      review: result[0],
    });
  } catch (error) {
    console.error("Error saving review:", error);
    return Response.json({ error: "Failed to save review" }, { status: 500 });
  }
}
