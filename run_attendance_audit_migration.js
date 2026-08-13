import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

console.log('Connecting to Supabase PostgreSQL database...');
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected successfully!');

  const sqlPath = path.resolve(__dirname, './database/04_add_attendance_audit_columns.sql');
  console.log(`Reading SQL migration from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration to add attendance audit columns (modified_by, modified_at, modification_reason)...');
  try {
    await client.query(sql);
    console.log('SUCCESS! employee_attendance audit columns added successfully!');
  } catch (err) {
    console.error('Error running migration:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
