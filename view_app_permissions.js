import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: permissions, error } = await supabase.from('app_permissions').select('*');
  if (error) {
    console.error('Error fetching permissions:', error);
  } else {
    console.log('App Permissions Rows in DB:', JSON.stringify(permissions, null, 2));
  }
}
run();
