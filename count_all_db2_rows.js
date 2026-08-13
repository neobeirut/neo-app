import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'users',
  'branches',
  'employees',
  'items',
  'menu_recipes',
  'menu_sections',
  'restaurants'
];

async function run() {
  console.log('Querying table counts (unfiltered)...');
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
