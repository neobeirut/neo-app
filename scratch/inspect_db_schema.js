import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const adminEmail = 'admin@thebistro.com';
const adminPassword = 'BistroPassword123!';

async function run() {
  console.log('1. Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  console.log('Authentication Succeeded!');

  console.log('2. Querying table info from postgres catalog...');
  
  // We can execute SQL queries if there is an RPC, or check if we can query pg_catalog tables via supabase.from().
  // Let's see if there is an rpc defined for running arbitrary SQL or inspecting schema.
  // Wait, let's look at list_all_rpcs.js or run a query on pg_catalog.
  // First, let's try querying standard schema information if RLS allows, or see if it fails.
  const { data: cols, error: colsErr } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable
      FROM 
        information_schema.columns 
      WHERE 
        table_name IN ('users', 'employees')
      ORDER BY 
        table_name, ordinal_position;
    `
  });

  if (colsErr) {
    console.log('RPC execute_sql not available or failed:', colsErr.message);
    // Let's try querying a list of RPCs or check if there is an RPC we can use.
  } else {
    console.log('Columns info:', cols);
  }
}

run().catch(console.error);
