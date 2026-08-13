import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const tables = ['items', 'users', 'branches', 'employees'];
  for (const table of tables) {
    console.log(`\n--- Unique restaurant_id values in table: ${table} ---`);
    const { data, error } = await supabase.from(table).select('restaurant_id');
    if (error) {
      console.error(`Error querying ${table}:`, error.message);
      continue;
    }
    const ids = new Set(data.map(row => row.restaurant_id));
    console.log(Array.from(ids));
    
    if (data.length > 0) {
      console.log(`Sample row keys from ${table}:`, Object.keys(data[0]));
    }
  }
  
  // Also let's check the restaurants table rows in detail
  const { data: restaurants, error: rError } = await supabase.from('restaurants').select('*');
  if (rError) {
    console.error('Error fetching restaurants:', rError.message);
  } else {
    console.log('\n--- Restaurants in DB ---', restaurants);
  }
}

run().catch(console.error);
