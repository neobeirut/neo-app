const postgres = require('./web/node_modules/postgres');
const db = postgres('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const tokens = await db`SELECT * FROM admin_push_tokens`;
  console.log('Admin Push Tokens:', tokens);
  await db.end();
}
run();
