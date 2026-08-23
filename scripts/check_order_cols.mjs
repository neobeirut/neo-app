import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const sql = "SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('order_id', 'related_order_id') AND table_schema = 'public';";
  const res = await pool.query(sql);
  console.table(res.rows);
  await pool.end();
}
run();
