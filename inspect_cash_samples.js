import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: pay } = await supabase.from('daily_payments').select('*').limit(1);
  console.log('daily_payments sample:', pay[0]);

  const { data: cash } = await supabase.from('shift_cash').select('*').limit(1);
  console.log('shift_cash sample:', cash[0]);
}

run().catch(console.error);
