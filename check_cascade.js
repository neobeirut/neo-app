import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT
        tc.table_name,
        kcu.column_name,
        rc.update_rule,
        rc.delete_rule
    FROM 
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('loans', 'payrolls', 'employee_attendance', 'tips_distribution', 'tp_assessments', 'tp_employee_training', 'employee_training_progress', 'employee_schedules', 'employee_payroll_items', 'employee_leave_requests', 'employee_shift_requests', 'employee_missing_punches', 'employee_attendance_breaks', 'users', 'employees');
  `);
  
  console.log("Delete rules for foreign keys:");
  res.rows.forEach(r => {
    console.log(`- ${r.table_name}.${r.column_name}: ON DELETE ${r.delete_rule}`);
  });
  
  await client.end();
}
run();
