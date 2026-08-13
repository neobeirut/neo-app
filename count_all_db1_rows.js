import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'users',
  'branches',
  'employees',
  'items',
  'menu_recipes',
  'menu_sections',
  'restaurants',
  'RestaurantNews',
  'departments'
];

async function run() {
  console.log('Querying table counts on DB1 (dybtzulafvtyfuqwsvkk)...');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`- ${table}: Error - ${error.message}`);
    } else {
      console.log(`- ${table}: ${count} rows`);
    }
  }
}

run().catch(console.error);
