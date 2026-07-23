import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const phone = request.headers.get("x-auth-phone") || request.headers.get("X-Auth-Phone");
    if (!phone) {
      return corsJson(Response.json({ success: false, error: "Unauthorized" }, { status: 401 }));
    }

    const body = await request.json();
    const { action, notes, branch, latitude, longitude } = body;

    const cleanPhone = '+' + phone.replace(/[^0-9]/g, "");

    const users = await sql`
      SELECT id, name, role, branch FROM users WHERE phone = ${cleanPhone} OR email = ${cleanPhone} LIMIT 1
    `;
    if (users.length === 0) {
      return corsJson(Response.json({ success: false, error: "No user found" }, { status: 404 }));
    }

    const userId = users[0].id;

    const employees = await sql`
      SELECT employee_id, first_name, last_name, branch FROM employees WHERE app_user_id = ${userId} LIMIT 1
    `;
    if (employees.length === 0) {
      return corsJson(Response.json({ success: false, error: "No employee profile found" }, { status: 404 }));
    }

    const employee = employees[0];
    let targetBranch = branch || employee.branch || 'Badaro';

    // Verify GPS Geofence for Punch against any valid active branch location
    if (latitude != null && longitude != null) {
      const allBranches = await sql`
        SELECT name, latitude, longitude, radius_meters FROM branches WHERE is_active = true OR is_active IS NULL
      `;

      const R = 6371000;
      let matchedBranchName = null;
      let minDistance = Infinity;

      for (const b of allBranches) {
        if (b.latitude != null && b.longitude != null) {
          const dLat = ((Number(b.latitude) - Number(latitude)) * Math.PI) / 180;
          const dLon = ((Number(b.longitude) - Number(longitude)) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((Number(latitude) * Math.PI) / 180) *
              Math.cos((Number(b.latitude) * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = R * c;
          const radius = b.radius_meters || 200;

          if (dist <= radius && dist < minDistance) {
            minDistance = dist;
            matchedBranchName = b.name;
          }
        }
      }

      // If user is at a valid branch location (e.g. Badaro), accept punch for that location!
      if (matchedBranchName) {
        targetBranch = matchedBranchName;
      } else if (allBranches.some(b => b.latitude != null)) {
        // GPS coordinates provided but user is not at any branch location
        return corsJson(Response.json({
          success: false,
          error: `Access Denied: Location verification Failed. You are not physically present at any branch location.`
        }, { status: 403 }));
      }
    }

    if (action === 'out') {
      const activeLogs = await sql`
        SELECT id FROM employee_attendance WHERE employee_id = ${employee.employee_id} AND punch_out IS NULL LIMIT 1
      `;
      if (activeLogs.length === 0) {
        return corsJson(Response.json({ success: false, error: "No active shift found to clock out" }, { status: 400 }));
      }
      
      const now = new Date().toISOString();
      await sql`
        UPDATE employee_attendance 
        SET punch_out = ${now}, punch_out_notes = ${notes || null}
        WHERE id = ${activeLogs[0].id}
      `;
      
      return corsJson(Response.json({ success: true, punchedOut: true }));
    } else {
      const activeLogs = await sql`
        SELECT id FROM employee_attendance WHERE employee_id = ${employee.employee_id} AND punch_out IS NULL LIMIT 1
      `;
      if (activeLogs.length > 0) {
        return corsJson(Response.json({ success: false, error: "Already clocked in" }, { status: 400 }));
      }

      const now = new Date().toISOString();
      await sql`
        INSERT INTO employee_attendance (employee_id, branch, punch_in, punch_in_notes, device_id)
        VALUES (${employee.employee_id}, ${branch || employee.branch || 'Badaro'}, ${now}, ${notes || null}, 'Mobile App')
      `;

      return corsJson(Response.json({ success: true, punchedIn: true }));
    }
  } catch (err) {
    console.error(err);
    return corsJson(Response.json({ success: false, error: err.message }, { status: 500 }));
  }
}
