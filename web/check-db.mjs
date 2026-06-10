import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres');

const rows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'whatsapp%' ORDER BY setting_key`;
console.log('=== WhatsApp Settings ===');
if (rows.length === 0) { console.log('NONE FOUND'); }
else { rows.forEach(r => console.log('  ' + r.setting_key + ': ' + r.setting_value)); }
