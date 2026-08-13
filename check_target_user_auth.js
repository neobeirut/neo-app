import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const adminEmail = 'admin@thebistro.com';
const adminPassword = 'BistroPassword123!';

async function run() {
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

  console.log('2. Fetching users under authenticated session...');
  const { data: users, error } = await supabase.from('users').select('*');
  console.log('Error:', error);
  console.log('Total users in DB2:', users ? users.length : null);
  console.log('Users list:', users);
}

run().catch(console.error);
