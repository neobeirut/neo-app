import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const phone = request.headers.get("x-auth-phone") || request.headers.get("X-Auth-Phone");
    if (!phone) {
      return corsJson(Response.json({ success: false, error: "Unauthorized" }, { status: 401 }));
    }

    const cleanPhone = '+' + phone.replace(/[^0-9]/g, "");

    const users = await sql`
      SELECT id, name, role, branch FROM users WHERE phone = ${cleanPhone} OR email = ${cleanPhone} LIMIT 1
    `;
    if (users.length === 0) {
      return corsJson(Response.json({ success: true, isEmployee: false }));
    }

    const userId = users[0].id;

    const employees = await sql`
      SELECT employee_id, first_name, last_name, branch, role FROM employees WHERE app_user_id = ${userId} LIMIT 1
    `;
    if (employees.length === 0) {
      return corsJson(Response.json({ success: true, isEmployee: false }));
    }

    const employee = employees[0];

    const activeLogs = await sql`
      SELECT id, punch_in, punch_in_notes, branch FROM employee_attendance WHERE employee_id = ${employee.employee_id} AND punch_out IS NULL LIMIT 1
    `;

    return corsJson(Response.json({
      success: true,
      isEmployee: true,
      employee,
      isClockedIn: activeLogs.length > 0,
      activeLog: activeLogs[0] || null
    }));
  } catch (err) {
    console.error(err);
    return corsJson(Response.json({ success: false, error: err.message }, { status: 500 }));
  }
}
