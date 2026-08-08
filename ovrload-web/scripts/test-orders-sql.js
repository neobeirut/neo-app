import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function testOrdersQuery() {
  try {
    const orders = await sql`
      SELECT 
        o.*,
        b.name as branch_name,
        b.address as branch_address,
        au.name as customer_name,
        au.email as customer_email,
        au.phone as customer_phone
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN auth_users au ON o.user_id = au.id
      LIMIT 10;
    `;
    console.log('🎉 Orders query executed cleanly! Count:', orders.length);
  } catch (err) {
    console.error('❌ Orders query error:', err);
  } finally {
    await sql.end();
  }
}

testOrdersQuery();
