import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { sendPushNotificationToUser } from "@/app/api/utils/pushNotification";

export async function OPTIONS(request) {
  return corsOptions(request);
}

async function notifyManagers({ action, employee, branch, timestamp }) {
  try {
    // 1. Check global notification settings
    const settingsRows = await sql`
      SELECT setting_value FROM app_settings WHERE setting_key = 'notifications' LIMIT 1
    `;
    if (settingsRows.length > 0) {
      let val = settingsRows[0].setting_value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch {}
      }
      if (val && val.attendance_punch === false) {
        return; // Notifications turned OFF globally
      }
    }

    const empName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || `Employee #${employee.employee_id}`;
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isOut = action === 'out';
    const title = isOut ? `🔴 Clock-Out: ${empName}` : `🟢 Clock-In: ${empName}`;
    const body = isOut
      ? `${empName} clocked OUT at ${branch} (${timeStr}).`
      : `${empName} clocked IN at ${branch} (${timeStr}).`;
    const notifType = isOut ? 'punch_out' : 'punch_in';

    // 2. Query managers and admins
    const managers = await sql`
      SELECT e.employee_id, e.app_user_id, e.branch, e.role, u.id as user_id
      FROM employees e
      LEFT JOIN users u ON e.app_user_id = u.id
      WHERE e.role IN ('Manager', 'Admin', 'SuperAdmin', 'General Manager', 'Branch Manager', 'Owner')
    `;

    for (const m of managers) {
      // Filter by branch if manager is assigned to a specific branch
      if (m.branch && m.branch !== 'All' && m.branch !== branch && !['Admin', 'SuperAdmin', 'Owner'].includes(m.role)) {
        continue;
      }

      // In-app notification
      try {
        await sql`
          INSERT INTO notifications (title, message, type, target_user_id, is_read, created_at)
          VALUES (${title}, ${body}, ${notifType}, ${m.employee_id}, false, ${timestamp})
        `;
      } catch (insertErr) {
        console.error(`[punch] Error inserting notification for manager ${m.employee_id}:`, insertErr.message);
      }

      // Expo Push notification
      const targetUserId = m.app_user_id || m.user_id;
      if (targetUserId) {
        try {
          await sendPushNotificationToUser(targetUserId, {
            title,
            body,
            data: {
              type: notifType,
              employee_id: employee.employee_id,
              branch,
              timestamp
            }
          });
        } catch (pushErr) {
          console.error(`[punch] Error sending push to manager ${targetUserId}:`, pushErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[punch] notifyManagers exception:', err);
  }
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
    const targetBranch = branch || employee.branch || 'Badaro';

    // Verify GPS Geofence for Punch if coordinates provided
    if (latitude != null && longitude != null) {
      const branchRows = await sql`
        SELECT latitude, longitude, radius_meters FROM branches WHERE name = ${targetBranch} LIMIT 1
      `;
      if (branchRows.length > 0) {
        const b = branchRows[0];
        if (b.latitude != null && b.longitude != null) {
          const R = 6371000;
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

          if (dist > radius) {
            return corsJson(Response.json({
              success: false,
              error: `Access Denied: Location verification Failed. You are ${Math.round(dist)}m away from ${targetBranch}. Must be within ${radius}m.`
            }, { status: 403 }));
          }
        }
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

      // Notify managers
      await notifyManagers({
        action: 'out',
        employee,
        branch: targetBranch,
        timestamp: now
      });
      
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
        VALUES (${employee.employee_id}, ${targetBranch}, ${now}, ${notes || null}, 'Mobile App')
      `;

      // Notify managers
      await notifyManagers({
        action: 'in',
        employee,
        branch: targetBranch,
        timestamp: now
      });

      return corsJson(Response.json({ success: true, punchedIn: true }));
    }
  } catch (err) {
    console.error(err);
    return corsJson(Response.json({ success: false, error: err.message }, { status: 500 }));
  }
}
