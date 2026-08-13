import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = 'test@flowonline.me';
  const password = 'NewPassword123!';

  console.log('Testing full dashboard login workflow...');
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*, restaurants:restaurant_id(*)')
    .eq('email', email)
    .single();

  if (error || !data) {
    console.error('Profile error:', error ? error.message : 'User profile not found.');
    return;
  }

  if (data.role !== 'Admin' && data.role !== 'Manager' && data.role !== 'SuperAdmin') {
    console.error('Access denied! User role is:', data.role);
    return;
  }

  console.log('LOGIN SUCCESS! User:', data.name, 'Role:', data.role, 'Restaurant:', data.restaurants?.name);
}

main().catch(console.error);
