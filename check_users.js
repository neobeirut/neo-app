import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  // let's check users table schema for any unique constraints on PIN
  const res = await client.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'users';
  `);
  console.log("Constraints on users:", res.rows);
  
  await client.end();
}
run();
