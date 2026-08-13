import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const buckets = ['hr_docs', 'training_media', 'recipes', 'logos'];

async function run() {
  const content = Buffer.from('test');
  for (const bucket of buckets) {
    console.log(`Testing upload to bucket: ${bucket}...`);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload('test_temp.txt', content, {
        contentType: 'text/plain',
        upsert: true
      });
    if (error) {
      console.log(`- ${bucket} failed: ${error.message}`);
    } else {
      console.log(`- ${bucket} succeeded! Path: ${data.path}`);
      // Clean up
      await supabase.storage.from(bucket).remove(['test_temp.txt']);
    }
  }
}

run().catch(console.error);
