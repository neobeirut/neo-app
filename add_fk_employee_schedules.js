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
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_employee_schedules_employees'
      ) THEN
        -- Add foreign key constraint if employee_id in employees is unique
        BEGIN
          ALTER TABLE public.employee_schedules
          ADD CONSTRAINT fk_employee_schedules_employees
          FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id)
          ON DELETE CASCADE;
          RAISE NOTICE 'Foreign key added successfully!';
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Could not add FK directly, will handle via JS join: %', SQLERRM;
        END;
      END IF;
    END $$;
  `;

  try {
    await client.query(sql);
    console.log('SQL execution finished.');
  } catch (err) {
    console.error('Error adding FK constraint:', err.message);
  } finally {
    await client.end();
  }
}

main();
