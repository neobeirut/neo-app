import { createClient } from '@supabase/supabase-js';

const db1 = {
  name: 'dybtzulafvtyfuqwsvkk (test_db.js)',
  url: 'https://dybtzulafvtyfuqwsvkk.supabase.co',
  key: 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF'
};

const db2 = {
  name: 'ibtbcgkkixkglnhhrrpu (.env)',
  url: 'https://ibtbcgkkixkglnhhrrpu.supabase.co',
  key: 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm'
};

async function inspect(db) {
  console.log(`\n=== Inspecting DB: ${db.name} ===`);
  const supabase = createClient(db.url, db.key);
  try {
    const { data: rList, error: rError } = await supabase.from('restaurants').select('*');
    if (rError) {
      console.log('Error fetching restaurants:', rError.message);
    } else {
      console.log(`Success! Found ${rList.length} restaurants:`);
      rList.forEach(r => {
        console.log(` - ID: ${r.id} | Name: ${r.name} | Primary Color: ${r.primary_color}`);
      });
    }
  } catch (e) {
    console.error('Exception:', e.message);
  }
}

async function run() {
  await inspect(db1);
  await inspect(db2);
}

run().catch(console.error);
