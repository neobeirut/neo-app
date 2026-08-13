import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'sub_departments',
  'suppliers',
  'items',
  'menu_recipes',
  'menu_sections',
  'users',
  'employees',
  'orders',
  'order_items'
];

async function run() {
  for (const table of tables) {
    console.log(`\n=== Sample row from table: ${table} ===`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error:`, error.message);
    } else if (data.length === 0) {
      console.log('Table is empty');
    } else {
      console.log(data[0]);
    }
  }
}

run().catch(console.error);
