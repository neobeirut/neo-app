import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name IN ('employees', 'users');
  `);
  
  console.log("Foreign keys pointing to employees or users:");
  res.rows.forEach(r => {
    console.log(`- ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
  });
  
  // also get all tables that have an employee_id or user_id or similar column
  const cols = await client.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND (column_name LIKE '%employee_id%' OR column_name LIKE '%user_id%' OR column_name LIKE '%user_name%');
  `);
  console.log("\nTables with employee/user related columns:");
  cols.rows.forEach(r => {
    console.log(`- ${r.table_name}.${r.column_name}`);
  });

  await client.end();
}
run();
