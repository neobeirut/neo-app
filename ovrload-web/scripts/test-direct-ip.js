import postgres from 'postgres';

const sql = postgres({
  host: '2406:da1a:314:7102:8ad4:9729:a7c9:5da2',
  port: 5432,
  user: 'postgres',
  pass: 'FsDdHJhoYDv1GsxW',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await sql`SELECT 1 as connected;`;
    console.log('🎉 CONNECTED VIA DIRECT IPV6!', res);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await sql.end();
  }
}

run();
