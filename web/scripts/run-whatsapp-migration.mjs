import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function run() {
  const envContent = fs.readFileSync('C:/Users/fredd/.gemini/antigravity/neo-app/web/.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  const dbUrl = match ? match[1] : null;

  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

  try {
    const migrationFile = 'C:/Users/fredd/.gemini/antigravity/neo-app/web/scripts/migrations/001_create_whatsapp_module_tables.sql';
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Running WhatsApp schema migration...');
    await sql.unsafe(migrationSql);
    console.log('✅ Migration 001_create_whatsapp_module_tables.sql executed successfully!');

    // Verify newly created/altered tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('whatsapp_contacts', 'whatsapp_conversations', 'whatsapp_messages', 'whatsapp_templates', 'whatsapp_campaigns', 'whatsapp_campaign_recipients', 'whatsapp_audit_logs')
      ORDER BY table_name;
    `;
    console.log('Verified tables:', tables.map(t => t.table_name));

    // Also populate default app_settings for whatsapp if not already present
    await sql`
      INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
      VALUES 
        ('whatsapp_service_window_hours', '24', now(), now()),
        ('whatsapp_default_country_code', '961', now(), now()),
        ('whatsapp_campaign_batch_size', '25', now(), now()),
        ('whatsapp_campaign_delay_ms', '500', now(), now())
      ON CONFLICT (setting_key) DO NOTHING;
    `;
    console.log('✅ Default WhatsApp app_settings seeded.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
