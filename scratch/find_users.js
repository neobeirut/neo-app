import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('--- ALL AUTH USERS ---');
  const authRes = await client.query(`SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 20;`);
  console.log(authRes.rows);

  console.log('--- ALL PUBLIC USERS ---');
  const pubRes = await client.query(`SELECT id, email, name, restaurant_id FROM public.users ORDER BY id DESC LIMIT 20;`);
  console.log(pubRes.rows);

  await client.end();
}

main().catch(console.error);
