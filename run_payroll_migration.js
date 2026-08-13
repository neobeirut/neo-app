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

  const sqlPath = path.resolve(__dirname, './database/02_create_payroll_tables.sql');
  console.log(`Reading SQL migration from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration to create payroll_periods and employee_payroll_items tables...');
  try {
    await client.query(sql);

    // Disable RLS & grant permissions to API roles
    const grantSql = `
      ALTER TABLE public.payroll_periods DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.employee_payroll_items DISABLE ROW LEVEL SECURITY;

      GRANT ALL ON public.payroll_periods TO anon, authenticated, service_role;
      GRANT ALL ON public.employee_payroll_items TO anon, authenticated, service_role;
    `;
    await client.query(grantSql);

    console.log('SUCCESS! payroll_periods and employee_payroll_items tables created and granted API permissions.');
  } catch (err) {
    console.error('Error running migration:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
