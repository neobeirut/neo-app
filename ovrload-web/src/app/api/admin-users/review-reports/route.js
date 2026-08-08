import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

// Get all review reports (admin only)
export async function GET(request) {
  try {
    const adminUser = await getAdminWithRolesFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const reports = await sql`
      SELECT 
        rr.*,
        pr.rating,
        pr.review_text,
        pr.product_id,
        p.name as product_name,
        reviewer.name as reviewer_name,
        reviewer.phone as reviewer_phone,
        reporter.name as reporter_name
      FROM review_reports rr
      JOIN product_reviews pr ON rr.review_id = pr.id
      JOIN products p ON pr.product_id = p.id
      JOIN auth_users reviewer ON pr.user_id = reviewer.id
      JOIN auth_users reporter ON rr.reporter_id = reporter.id
      WHERE rr.status = ${status}
      ORDER BY rr.created_at DESC
    `;

    return Response.json({ reports });
  } catch (error) {
    console.error("Error fetching review reports:", error);
    return Response.json(
      { error: "Failed to fetch review reports" },
      { status: 500 },
    );
  }
}

// Resolve a review report (admin only)
export async function POST(request) {
  try {
    const adminUser = await getAdminWithRolesFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { report_id, action } = await request.json();

    if (!report_id || !action) {
      return Response.json(
        { error: "Report ID and action are required" },
        { status: 400 },
      );
    }

    if (
      !["approve", "reject", "delete_review", "block_user"].includes(action)
    ) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get report details
    const reports = await sql`
      SELECT rr.*, pr.user_id, pr.product_id
      FROM review_reports rr
      JOIN product_reviews pr ON rr.review_id = pr.id
      WHERE rr.id = ${report_id}
    `;

    if (reports.length === 0) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const report = reports[0];

    if (action === "delete_review") {
      // Delete the review
      await sql`DELETE FROM product_reviews WHERE id = ${report.review_id}`;

      // Update product rating
      await sql`
        UPDATE products 
        SET rating = (
          SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
          FROM product_reviews 
          WHERE product_id = ${report.product_id}
        )
        WHERE id = ${report.product_id}
      `;
    } else if (action === "block_user") {
      // Block the user who wrote the review
      await sql`
        UPDATE auth_users 
        SET is_active = false
        WHERE id = ${report.user_id}
      `;

      // Delete the review
      await sql`DELETE FROM product_reviews WHERE id = ${report.review_id}`;

      // Update product rating
      await sql`
        UPDATE products 
        SET rating = (
          SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
          FROM product_reviews 
          WHERE product_id = ${report.product_id}
        )
        WHERE id = ${report.product_id}
      `;
    }

    // Mark report as resolved
    await sql`
      UPDATE review_reports 
      SET 
        status = ${action === "reject" ? "rejected" : "resolved"},
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = ${adminUser.id}
      WHERE id = ${report_id}
    `;

    return Response.json({
      success: true,
      message: "Report resolved successfully",
    });
  } catch (error) {
    console.error("Error resolving review report:", error);
    return Response.json(
      { error: "Failed to resolve report" },
      { status: 500 },
    );
  }
}
