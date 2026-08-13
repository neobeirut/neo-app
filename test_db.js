import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('restaurants').select('*');
  if (error) {
    console.error('Error fetching restaurants:', error);
  } else {
    console.log('Restaurants count:', data.length);
    console.log('Restaurants list:', data);
  }
}

test().catch(console.error);
