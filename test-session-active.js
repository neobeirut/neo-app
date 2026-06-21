const postgres = require('./web/node_modules/postgres');
const db = postgres('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    const phone = '9613361515';
    const cleanPhone = phone.replace("+", "").replace(/\s+/g, "");
    
    const [conversation] = await db`
      SELECT customer_id, phone FROM whatsapp_conversations 
      WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${cleanPhone} OR phone = ${phone}
      LIMIT 1
    `;
    console.log('Conversation:', conversation);

    const [user] = conversation?.customer_id ? await db`
      SELECT last_whatsapp_inbound_at
      FROM auth_users
      WHERE id = ${conversation.customer_id}
      LIMIT 1
    ` : [null];
    console.log('User:', user);

    const [lastMsg] = await db`
      SELECT id, phone, direction, message_type, message_text, created_at
      FROM customer_whatsapp_messages
      WHERE (REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${cleanPhone} OR phone = ${phone})
        AND direction = 'inbound'
        AND message_type != 'debug_raw_payload'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    console.log('LastMsg:', lastMsg);

    const lastInboundTime = user?.last_whatsapp_inbound_at 
      ? new Date(user.last_whatsapp_inbound_at) 
      : lastMsg?.created_at 
        ? new Date(lastMsg.created_at) 
        : null;
    console.log('LastInboundTime:', lastInboundTime);

    const isSessionActive = lastInboundTime 
      ? (Date.now() - lastInboundTime.getTime()) / (1000 * 60 * 60) < 24 
      : false;
    console.log('IsSessionActive:', isSessionActive);

  } catch (err) {
    console.error(err);
  } finally {
    await db.end();
  }
}
run();
