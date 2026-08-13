import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: users, error } = await supabase.from('users').select('*');
  console.log('Error:', error);
  console.log('Total users in DB2:', users ? users.length : null);
  console.log('Users:', users);
}

run().catch(console.error);
