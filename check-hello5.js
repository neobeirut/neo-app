const postgres = require('./web/node_modules/postgres');
const db = postgres('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const msgs = await db`SELECT id, phone, message_text, created_at, status, error FROM customer_whatsapp_messages WHERE message_text LIKE '%hello5%'`;
  console.log(msgs);
  await db.end();
}
run();
