import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('=== RESTAURANTS ===');
  const restoRes = await client.query(`SELECT id, name, created_at FROM public.restaurants ORDER BY created_at DESC;`);
  console.table(restoRes.rows);

  console.log('=== PUBLIC USERS ===');
  const pubUsersRes = await client.query(`
    SELECT u.id, u.name, u.email, u.role, u.pin, u.restaurant_id, r.name AS restaurant_name 
    FROM public.users u 
    LEFT JOIN public.restaurants r ON u.restaurant_id = r.id 
    ORDER BY u.id ASC;
  `);
  console.table(pubUsersRes.rows);

  console.log('=== AUTH USERS ===');
  const authUsersRes = await client.query(`
    SELECT id, email, created_at, last_sign_in_at 
    FROM auth.users 
    ORDER BY created_at DESC;
  `);
  console.table(authUsersRes.rows);

  await client.end();
}

main().catch(console.error);
