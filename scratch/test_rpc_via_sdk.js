import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  // Sign in as freddykhoury@gmail.com (the super admin)
  console.log('--- Signing in as super admin via Supabase SDK ---');
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'freddykhoury@gmail.com',
    password: 'Admin1234!',
  });

  if (signInErr) {
    // Try alternate passwords
    console.log('Failed with Admin1234!, trying FreddyAdmin2024!...');
    const { error: signInErr2 } = await supabase.auth.signInWithPassword({
      email: 'freddykhoury@gmail.com',
      password: 'FreddyAdmin2024!',
    });
    if (signInErr2) {
      console.log('Also failed. Testing with Freddy2024!...');
      const { error: signInErr3 } = await supabase.auth.signInWithPassword({
        email: 'freddykhoury@gmail.com',
        password: 'Freddy2024!',
      });
      if (signInErr3) {
        console.error('All sign-in attempts failed. Please tell me the super admin password to test.');
        return;
      }
    }
  }

  console.log('Signed in!');

  const session = await supabase.auth.getSession();
  console.log('Session user:', session.data.session?.user?.email);

  console.log('\n--- Calling RPC via SDK (as signed-in super admin) ---');
  const { data, error: rpcErr } = await supabase.rpc('update_tenant_admin_credentials', {
    p_restaurant_id: '4c0ed960-e459-42c4-962f-41229a2d3783',
    p_admin_id: '1530cdcb-928c-4f1f-bdc9-27498c0c8d83',
    p_admin_name: 'Bistro Admin',
    p_admin_email: 'admin@thebistro.com',
    p_admin_pin: '1234',
    p_admin_password: 'BistroTestPass456!',
  });

  if (rpcErr) {
    console.error('RPC ERROR (this reveals the problem):', JSON.stringify(rpcErr, null, 2));
  } else {
    console.log('RPC returned:', data);

    // Verify login with new password
    await supabase.auth.signOut();
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'admin@thebistro.com',
      password: 'BistroTestPass456!',
    });
    if (loginErr) {
      console.error('Login failed after RPC update:', loginErr.message);
    } else {
      console.log('Login SUCCESS after RPC update! User:', loginData.user?.email);
    }
  }
}

main().catch(console.error);
