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

  // The best strategy: join with auth.users to get the oldest auth account for this restaurant
  // This is the "real" tenant admin who was provisioned first
  console.log('=== Strategy: Join public.users + auth.users, get OLDEST auth account ===');
  const result = await db.query(`
    SELECT pu.id, pu.name, pu.email, pu.pin, pu.role, au.created_at as auth_created
    FROM public.users pu
    INNER JOIN auth.users au ON au.id = pu.id
    WHERE pu.restaurant_id = $1
      AND pu.role IN ('Admin', 'Manager', 'SuperAdmin')
    ORDER BY au.created_at ASC
    LIMIT 1;
  `, [BISTRO_ID]);
  console.log('Best candidate (oldest auth admin):');
  console.table(result.rows);

  const admin = result.rows[0];
  if (!admin) {
    console.error('No result found!');
    await db.end();
    return;
  }
  console.log('→ Edit modal should show: email =', admin.email, ', id =', admin.id);

  // Now test the RPC with this correct admin
  console.log('\n=== Testing password update for CORRECT admin ===');
  const NEW_PASSWORD = 'BistroCorrect123!';
  const rpcRes = await db.query(`
    SELECT public.update_tenant_admin_credentials($1, $2, $3, $4, $5, $6);
  `, [BISTRO_ID, admin.id, admin.name, admin.email, admin.pin, NEW_PASSWORD]);
  console.log('RPC result:', rpcRes.rows[0]);

  // Verify login
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: admin.email,
    password: NEW_PASSWORD,
  });
  console.log('Login with new password:', loginErr ? `FAILED: ${loginErr.message}` : 'SUCCESS!');

  await db.end();
}

main().catch(console.error);
