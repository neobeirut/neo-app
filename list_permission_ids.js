import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('app_permissions').select('id, type');
  console.log('Error:', error);
  console.log('Permission IDs in DB1:', data);
}

run().catch(console.error);
