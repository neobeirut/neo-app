import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BISTRO_ID = '4c0ed960-e459-42c4-962f-41229a2d3783';

async function main() {
  await db.connect();

  // Check columns on public.users
  const cols = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log('=== public.users columns ===');
  console.table(cols.rows);

  // Now fetch using correct columns
  const tenantAdmin = await db.query(`
    SELECT id, name, email, pin
    FROM public.users
    WHERE restaurant_id = $1
      AND role IN ('Admin', 'Manager', 'SuperAdmin')
      AND email IS NOT NULL
    ORDER BY id ASC
    LIMIT 1;
  `, [BISTRO_ID]);
  console.log('\n=== Tenant Admin (first Admin/Manager with email) ===');
  console.table(tenantAdmin.rows);
  const admin = tenantAdmin.rows[0];

  if (!admin) {
    console.error('No admin found!');
    await db.end();
    return;
  }

  // Simulate RPC call as anon role
  console.log('\n=== Simulating RPC call as anon role ===');
  await db.query(`SET ROLE authenticator; SET LOCAL ROLE anon;`);
  const NEW_PASSWORD = 'FinalTestPass789!';
  try {
    const rpcRes = await db.query(`
      SELECT public.update_tenant_admin_credentials($1, $2, $3, $4, $5, $6);
    `, [BISTRO_ID, admin.id, admin.name, admin.email, admin.pin, NEW_PASSWORD]);
    console.log('RPC result:', rpcRes.rows[0]);
  } catch (e) {
    console.error('RPC ERROR:', e.message);
    await db.end();
    return;
  }
  await db.query('RESET ROLE;');

  // Verify login
  console.log('\n=== Verifying login ===');
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: admin.email,
    password: NEW_PASSWORD,
  });
  if (loginErr) {
    console.error('LOGIN FAILED:', loginErr.message);
  } else {
    console.log('LOGIN SUCCESS! User:', loginData.user?.email);
    const { data: userData } = await supabase
      .from('users')
      .select('name, role, restaurant_id')
      .eq('email', admin.email)
      .single();
    console.log('Profile:', userData);
  }

  await db.end();
}

main().catch(console.error);
