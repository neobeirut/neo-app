import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('--- PUBLIC USER FOR SAMI ISSA ---');
  const uRes = await client.query(`SELECT * FROM public.users WHERE id = '14bdd1c1-ae15-4b59-8dfd-eca6f1a84187' OR restaurant_id = '4c0ed960-e459-42c4-962f-41229a2d3783';`);
  console.log(uRes.rows);

  await client.end();
}

main().catch(console.error);
