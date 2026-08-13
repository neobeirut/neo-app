import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const newId = '88888888-8888-8888-8888-888888888888';
  console.log('Testing insert of a restaurant...');
  const { data, error } = await supabase.from('restaurants').insert({
    id: newId,
    name: 'Test Demo Restaurant',
    primary_color: '#ff5722',
    settings: { enabled_sections: ['orders', 'items', 'menu'] }
  }).select();
  
  if (error) {
    console.error('Error inserting restaurant:', error.message);
  } else {
    console.log('Successfully inserted restaurant:', data);
    
    // Clean it up immediately so we don't leave junk
    const { error: delError } = await supabase.from('restaurants').delete().eq('id', newId);
    console.log('Cleanup error:', delError);
  }
}

run().catch(console.error);
