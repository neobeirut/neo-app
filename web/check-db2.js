const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres');

async function main() {
  try {
    // Check all whatsapp settings
    const rows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key LIKE 'whatsapp%' 
      ORDER BY setting_key
    `;
    
    console.log('=== WhatsApp App Settings ===');
    if (rows.length === 0) {
      console.log('NONE FOUND');
    } else {
      rows.forEach(r => console.log('  ' + r.setting_key + ': ' + r.setting_value));
    }

    // Check OTP template specifically
    const otpRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key = 'whatsapp_template_otp'
    `;
    
    console.log('\n=== OTP Template Setting ===');
    if (otpRows.length === 0) {
      console.log('❌ whatsapp_template_otp NOT in DB - needs to be inserted');
    } else {
      console.log('✅ Found: ' + otpRows[0].setting_value);
    }
  } catch(e) {
    console.error('DB Error:', e.message);
    if (e.cause) console.error('Cause:', e.cause.message);
  }
}

main();
