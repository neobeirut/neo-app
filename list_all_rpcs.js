import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Query Supabase RPC definitions from the pg_proc system catalog if exposed,
  // or check what RPCs exist by trying to call a nonexistent function and parsing the error.
  const { data, error } = await supabase.rpc('nonexistent_function_name_to_get_list');
  console.log('Error message (this should list available functions or show pg error):', error ? error.message : null);
}

run().catch(console.error);
