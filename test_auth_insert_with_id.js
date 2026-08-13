import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabaseTar = createClient(supabaseUrl, supabaseAnonKey);

const adminEmail = 'bistro_admin_temp2@thebistro.com';
const adminPassword = 'TempPassword123!';
const adminPin = '9998';
const adminName = 'Temp Bistro Admin 2';

async function run() {
  console.log('1. Calling create_tenant_admin RPC...');
  const { data: restoId, error: rpcError } = await supabaseTar.rpc('create_tenant_admin', {
    r_name: 'Temp Test Bistro 2',
    r_logo: 'https://app.neobeirut.com/logo-512x512.png',
    r_color: '#0a3a2a',
    u_name: adminName,
    u_email: adminEmail,
    u_password: adminPassword,
    u_pin: adminPin
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError.message);
    return;
  }
  console.log('RPC Succeeded. Created restaurant ID:', restoId);

  console.log('2. Authenticating...');
  const { error: authError } = await supabaseTar.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  console.log('Authentication Succeeded!');

  console.log('3. Testing insert with explicit integer id...');
  const { data: deptData, error: deptError } = await supabaseTar
    .from('departments')
    .insert({
      id: 999, // Explicit ID
      name: 'Temp Bar 999',
      restaurant_id: restoId
    })
    .select();

  if (deptError) {
    console.error('Insert failed:', deptError.message);
  } else {
    console.log('Insert succeeded! Inserted row:', deptData);
    
    // Clean up
    console.log('Cleaning up...');
    await supabaseTar.from('departments').delete().eq('id', 999);
    await supabaseTar.from('restaurants').delete().eq('id', restoId);
  }
}

run().catch(console.error);
