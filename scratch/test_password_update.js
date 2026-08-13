import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test exactly what the frontend does:
// 1. Call as super admin session first
const SUPER_ADMIN_EMAIL = 'freddykhoury@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Admin1234!';

async function main() {
  console.log('--- Step 1: Sign in as Super Admin ---');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  });
  if (authErr) {
    console.error('Super admin sign-in failed:', authErr.message);
    return;
  }
  console.log('Super admin signed in OK');

  const BISTRO_ID = '4c0ed960-e459-42c4-962f-41229a2d3783';
  const BISTRO_ADMIN_ID = '1530cdcb-928c-4f1f-bdc9-27498c0c8d83'; // Bistro Admin user
  const NEW_PASSWORD = 'TestPassword99!';

  console.log('--- Step 2: Call update_tenant_admin_credentials RPC ---');
  const { data, error: rpcErr } = await supabase.rpc('update_tenant_admin_credentials', {
    p_restaurant_id: BISTRO_ID,
    p_admin_id: BISTRO_ADMIN_ID,
    p_admin_name: 'Bistro Admin',
    p_admin_email: 'admin@thebistro.com',
    p_admin_pin: '1234',
    p_admin_password: NEW_PASSWORD,
  });

  if (rpcErr) {
    console.error('RPC ERROR:', JSON.stringify(rpcErr, null, 2));
  } else {
    console.log('RPC returned:', data);
  }

  // Now verify auth.users was actually updated
  console.log('--- Step 3: Sign out and try logging in with new password ---');
  await supabase.auth.signOut();
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@thebistro.com',
    password: NEW_PASSWORD,
  });
  if (loginErr) {
    console.error('LOGIN FAILED after password update:', loginErr.message);
  } else {
    console.log('LOGIN SUCCESS with new password!');
  }
}

main().catch(console.error);
