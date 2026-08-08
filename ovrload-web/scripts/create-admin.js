import postgres from 'postgres';
import { hash } from 'argon2';

const dbUrl = 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

const email = 'ovrload.lb@gmail.com';
const rawPassword = 'Ovrload2026!Admin';
const name = 'Ovrload Admin';

const allRoles = ['owner', 'admin', 'orders', 'menu', 'settings', 'customers', 'reports'];

async function updateAdminRoles() {
  console.log(`Updating all roles for ${email}...`);

  try {
    const passwordHash = await hash(rawPassword);

    const [user] = await sql`
      INSERT INTO admin_users (email, name, password, is_active, created_at)
      VALUES (${email.toLowerCase()}, ${name}, ${passwordHash}, true, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE 
      SET email = ${email.toLowerCase()}, password = ${passwordHash}, is_active = true
      RETURNING id, email, name;
    `;

    // Clear old roles and insert all roles
    await sql`DELETE FROM admin_user_roles WHERE admin_user_id = ${user.id};`;

    for (const role of allRoles) {
      await sql`
        INSERT INTO admin_user_roles (admin_user_id, role)
        VALUES (${user.id}, ${role});
      `;
    }

    const currentRoles = await sql`
      SELECT role FROM admin_user_roles WHERE admin_user_id = ${user.id};
    `;

    console.log(`\n🎉 ADMIN USER ROLES UPDATED SUCCESSFULLY!`);
    console.log(`User ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Roles:`, currentRoles.map(r => r.role));
  } catch (err) {
    console.error('❌ Error updating admin roles:', err);
  } finally {
    await sql.end();
  }
}

updateAdminRoles();
