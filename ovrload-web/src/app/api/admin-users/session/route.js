import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

// Returns the current admin (including roles) based on x-admin-token
export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    return Response.json({ admin });
  } catch (error) {
    console.error("Error fetching admin session:", error);
    return Response.json(
      { error: "Failed to fetch admin session" },
      { status: 500 },
    );
  }
}
