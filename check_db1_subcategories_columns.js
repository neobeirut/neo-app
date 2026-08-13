import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('training_subcategories').select('*').limit(1);
  console.log('Error:', error);
  console.log('Sample row from training_subcategories in DB1:', data ? data[0] : null);
}

run().catch(console.error);
