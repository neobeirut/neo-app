import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*').limit(1);
  console.log('tasks sample:', tasks ? tasks[0] : null);
}

run().catch(console.error);
