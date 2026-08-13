import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT id, email, encrypted_password
    FROM auth.users
    WHERE email = 'test@flowonline.me';
  `);
  console.log('User row:', res.rows[0]);

  // Test crypt matching in postgres
  const testRes = await client.query(`
    SELECT (encrypted_password = crypt('NewPassword123!', encrypted_password)) AS matches
    FROM auth.users
    WHERE email = 'test@flowonline.me';
  `);
  console.log('Postgres crypt matches:', testRes.rows[0]);

  await client.end();
}

main().catch(console.error);
