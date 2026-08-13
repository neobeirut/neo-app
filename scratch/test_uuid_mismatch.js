import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  await db.connect();

  // Test exact scenario: call RPC via anon Supabase SDK (no session) — same as frontend
  // when super admin is logged in, but we don't have their password
  // Instead, test via anon role in DB directly

  console.log('=== Test 1: Bistro Admin (admin@thebistro.com) with correct admin_id ===');
  await db.query(`SET ROLE authenticator; SET LOCAL ROLE anon;`);
  try {
    const r1 = await db.query(`
      SELECT public.update_tenant_admin_credentials(
        '4c0ed960-e459-42c4-962f-41229a2d3783'::uuid,
        '1530cdcb-928c-4f1f-bdc9-27498c0c8d83'::uuid,
        'Bistro Admin',
        'admin@thebistro.com',
        '1234',
        'DirectTest111!'
      );
    `);
    console.log('Result:', r1.rows[0]);
  } catch (e) {
    console.error('ERROR:', e.message);
  }

  // Reset role for next test
  await db.query(`RESET ROLE;`);

  // Now check the updated_at to confirm it was updated
  const check1 = await db.query(`
    SELECT email, substring(encrypted_password, 1, 20) as pw_start, updated_at 
    FROM auth.users WHERE email = 'admin@thebistro.com';
  `);
  console.log('Auth record after test 1:');
  console.table(check1.rows);

  // Verify login
  const { error: l1 } = await supabase.auth.signInWithPassword({
    email: 'admin@thebistro.com',
    password: 'DirectTest111!',
  });
  console.log('Login test 1:', l1 ? `FAILED: ${l1.message}` : 'SUCCESS!');

  // Now simulate scenario 2: new restaurant, admin_id provided as UUID but 
  // the auth.users record has a DIFFERENT uuid (mismatch)
  console.log('\n=== Test 2: Check for mismatched UUIDs (public.users.id vs auth.users.id) ===');
  const bistroAdmin = await db.query(`
    SELECT pu.id as public_id, au.id as auth_id, pu.email as pub_email, au.email as auth_email
    FROM public.users pu
    LEFT JOIN auth.users au ON au.email = pu.email
    WHERE pu.restaurant_id = '4c0ed960-e459-42c4-962f-41229a2d3783'
      AND pu.role IN ('Admin', 'Manager', 'SuperAdmin')
    ORDER BY pu.id ASC;
  `);
  console.log('Public users vs Auth users (matching by email):');
  console.table(bistroAdmin.rows);

  // Check if there are any mismatches where public.users.id != auth.users.id
  const mismatch = bistroAdmin.rows.filter(r => r.public_id !== r.auth_id && r.auth_id !== null);
  if (mismatch.length > 0) {
    console.log('⚠️  ID MISMATCH DETECTED! This is the bug:');
    console.table(mismatch);
    console.log('The RPC uses p_admin_id (public.users.id) to find auth.users, but they have different IDs!');
  } else {
    console.log('No ID mismatches found.');
  }

  await db.end();
}

main().catch(console.error);
