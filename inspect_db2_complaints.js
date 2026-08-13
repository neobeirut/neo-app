import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Querying using the anon key (which has access if RLS allows or is disabled)
  const { data, error } = await supabase.from('ClientComplaints').select('*').limit(1);
  console.log('Error:', error);
  console.log('ClientComplaints row in DB2:', data);
}

run().catch(console.error);
