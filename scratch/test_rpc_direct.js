import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';

async function main() {
  await client.connect();

  // Step 1: Test RPC via direct SQL (as postgres superuser) - this verifies the RPC itself works
  console.log('--- Step 1: Call RPC directly as postgres (bypasses anon key) ---');
  try {
    const rpcRes = await client.query(`
      SELECT public.update_tenant_admin_credentials(
        '4c0ed960-e459-42c4-962f-41229a2d3783',
        '1530cdcb-928c-4f1f-bdc9-27498c0c8d83',
        'Bistro Admin',
        'admin@thebistro.com',
        '1234',
        'NewBistroPass123!'
      );
    `);
    console.log('RPC result:', rpcRes.rows[0]);
  } catch (e) {
    console.error('RPC error:', e.message);
  }

  // Step 2: Check what password hash is now stored
  console.log('\n--- Step 2: Check auth.users encrypted_password after RPC ---');
  const hashRes = await client.query(`
    SELECT id, email, substring(encrypted_password, 1, 30) as pw_prefix, updated_at
    FROM auth.users WHERE email = 'admin@thebistro.com';
  `);
  console.table(hashRes.rows);

  await client.end();

  // Step 3: Try Supabase login with the new password
  console.log('\n--- Step 3: Try login with new password via Supabase SDK ---');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@thebistro.com',
    password: 'NewBistroPass123!',
  });
  if (loginErr) {
    console.error('LOGIN FAILED:', loginErr.message);
  } else {
    console.log('LOGIN SUCCESS! User ID:', loginData.user?.id);
  }
}

main().catch(console.error);
