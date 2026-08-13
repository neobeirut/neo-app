import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Check what auth users exist
  const res = await client.query(`
    SELECT u.id, u.email, u.role, u.encrypted_password IS NOT NULL as has_password,
           u.email_confirmed_at IS NOT NULL as email_confirmed,
           u.created_at,
           pu.name, pu.role as pub_role, pu.restaurant_id
    FROM auth.users u
    LEFT JOIN public.users pu ON pu.id = u.id OR pu.email = u.email
    ORDER BY u.created_at DESC
    LIMIT 20;
  `);
  console.log('=== AUTH + PUBLIC USERS ===');
  console.table(res.rows);

  // Now check auth.users for Bistro admin directly  
  const authRes = await client.query(`
    SELECT id, email, encrypted_password IS NOT NULL as has_pw, email_confirmed_at IS NOT NULL as confirmed
    FROM auth.users
    WHERE email = 'admin@thebistro.com' OR email = 'test@flowonline.me'
  `);
  console.log('\n=== BISTRO ADMIN AUTH RECORDS ===');
  console.table(authRes.rows);

  await client.end();
}

main().catch(console.error);
