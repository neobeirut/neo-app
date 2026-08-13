import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: waste } = await supabase.from('waste_logs').select('*').limit(1);
  console.log('waste_logs sample:', waste[0]);

  const { data: submission } = await supabase.from('checklist_submissions').select('*').limit(1);
  console.log('checklist_submissions sample:', submission[0]);
}

run().catch(console.error);
