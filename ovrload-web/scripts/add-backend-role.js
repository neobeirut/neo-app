import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function addBackendRoleAll() {
  console.log('Adding "backend" role to ALL admin users...');

  try {
    const adminUsers = await sql`SELECT id, email FROM admin_users;`;
    console.log(`Found ${adminUsers.length} admin users:`, adminUsers);

    for (const u of adminUsers) {
      await sql`
        INSERT INTO admin_user_roles (admin_user_id, role)
        VALUES (${u.id}, 'backend')
        ON CONFLICT DO NOTHING;
      `;
    }

    console.log('🎉 "backend" role granted to all admin users!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

addBackendRoleAll();
