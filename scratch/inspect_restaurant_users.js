import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('--- ALL RESTAURANTS ---');
  const restoRes = await client.query(`SELECT id, name FROM public.restaurants ORDER BY created_at DESC;`);
  console.table(restoRes.rows);

  console.log('--- USERS FOR RESTAURANTS ---');
  const userRes = await client.query(`
    SELECT u.id AS public_user_id, u.name, u.email AS public_email, u.restaurant_id, r.name AS restaurant_name, a.id AS auth_user_id, a.email AS auth_email
    FROM public.users u
    LEFT JOIN public.restaurants r ON u.restaurant_id = r.id
    LEFT JOIN auth.users a ON u.id = a.id OR u.email = a.email
    ORDER BY u.id;
  `);
  console.table(userRes.rows);

  await client.end();
}

main().catch(console.error);
