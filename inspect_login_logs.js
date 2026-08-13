import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data } = await supabase.from('login_logs').select('*').limit(1);
  console.log('login_logs sample:', data ? data[0] : null);
}

run().catch(console.error);
