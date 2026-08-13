import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected!');

  // Check sample rows in app_permissions
  const res = await client.query(`SELECT id, name, restaurant_id FROM app_permissions LIMIT 5;`);
  console.log('Existing app_permissions sample:', res.rows);

  await client.end();
}

main().catch(console.error);
