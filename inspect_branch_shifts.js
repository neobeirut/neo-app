import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const adminEmail = 'admin@thebistro.com';
const adminPassword = 'BistroPassword123!';

async function inspect() {
  console.log('1. Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  console.log('Authentication Succeeded! User:', authData.user.email);

  console.log('\n--- Inspecting shift_cash ---');
  const { data: scData, error: scError } = await supabase.from('shift_cash').select('*').limit(3);
  if (scError) {
    console.error('Error shift_cash:', scError.message);
  } else {
    console.log('shift_cash count:', scData.length);
    console.log('shift_cash row sample:', scData);
  }
}

inspect().catch(console.error);
