import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to DB...');

  const sql = `
    ALTER TABLE public.shift_templates DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.employee_schedules DISABLE ROW LEVEL SECURITY;

    GRANT ALL ON public.shift_templates TO anon, authenticated, service_role;
    GRANT ALL ON public.employee_schedules TO anon, authenticated, service_role;
  `;

  try {
    await client.query(sql);
    console.log('Permissions & RLS updated successfully on shift_templates and employee_schedules!');
  } catch (err) {
    console.error('Error updating permissions:', err.message);
  } finally {
    await client.end();
  }
}

main();
