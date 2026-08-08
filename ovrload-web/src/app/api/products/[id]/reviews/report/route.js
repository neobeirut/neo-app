import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^0-9+]/g, "");
  return cleaned || null;
}

// Report a review as inappropriate
export async function POST(request, { params }) {
  try {
    const session = await auth();
    const body = await request.json();
    const { review_id, reason } = body;
    const phone = normalizePhone(body?.phone);

    let reporterId;

    if (session?.user?.id) {
      reporterId = session.user.id;
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
      reporterId = user[0].id;
    } else {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!review_id || !reason) {
      return Response.json(
        { error: "Review ID and reason are required" },
        { status: 400 },
      );
    }

    // Create review_reports table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS review_reports (
        id SERIAL PRIMARY KEY,
        review_id INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
        reporter_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES admin_users(id)
      )
    `;

    // Check if user already reported this review
    const existingReport = await sql`
      SELECT id FROM review_reports 
      WHERE review_id = ${review_id} AND reporter_id = ${reporterId}
    `;

    if (existingReport.length > 0) {
      return Response.json(
        { error: "You have already reported this review" },
        { status: 400 },
      );
    }

    // Insert report
    await sql`
      INSERT INTO review_reports (review_id, reporter_id, reason)
      VALUES (${review_id}, ${reporterId}, ${reason})
    `;

    return Response.json({
      success: true,
      message: "Review reported successfully. Our team will review it shortly.",
    });
  } catch (error) {
    console.error("Error reporting review:", error);
    return Response.json({ error: "Failed to report review" }, { status: 500 });
  }
}
