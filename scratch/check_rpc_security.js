import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Check the RPC definition for SECURITY DEFINER
  const def = await client.query(`
    SELECT routine_name, security_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('update_tenant_admin_credentials', 'create_tenant_admin', 'update_tenant_admin_password');
  `);
  console.log('=== RPC SECURITY TYPE ===');
  console.table(def.rows);

  // Check if the RPC is accessible to anon / authenticated roles
  const grants = await client.query(`
    SELECT grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
      AND routine_name = 'update_tenant_admin_credentials';
  `);
  console.log('\n=== RPC GRANTS ===');
  console.table(grants.rows);

  // Simulate what the anon role would see - run as authenticator
  console.log('\n--- Testing RPC as authenticator role (mimics anon/authenticated key) ---');
  await client.query(`SET ROLE authenticator;`);
  await client.query(`SET LOCAL ROLE anon;`);
  try {
    const res = await client.query(`
      SELECT public.update_tenant_admin_credentials(
        '4c0ed960-e459-42c4-962f-41229a2d3783',
        '1530cdcb-928c-4f1f-bdc9-27498c0c8d83',
        'Bistro Admin',
        'admin@thebistro.com',
        '1234',
        'AnonRoleTest789!'
      );
    `);
    console.log('Anon role RPC result:', res.rows[0]);
  } catch (e) {
    console.error('Anon role RPC ERROR:', e.message);
  }

  await client.end();
}

main().catch(console.error);
