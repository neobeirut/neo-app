import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await db.connect();

  // Show the exact state of the Bistro restaurant:
  // 1. Which public.users are marked as Admin/Manager
  // 2. Which of those have auth.users records
  // 3. What email is in the Edit modal (from getTenantAdmin API call)

  console.log('=== BISTRO: All Admin/Manager public.users ===');
  const admins = await db.query(`
    SELECT id, name, email, role, pin
    FROM public.users
    WHERE restaurant_id = '4c0ed960-e459-42c4-962f-41229a2d3783'
      AND role IN ('Admin', 'Manager', 'SuperAdmin')
    ORDER BY id ASC;
  `);
  console.table(admins.rows);

  console.log('\n=== What getTenantAdmin returns (first Admin/Manager user with email) ===');
  const tenantAdmin = await db.query(`
    SELECT id, name, email, pin
    FROM public.users
    WHERE restaurant_id = '4c0ed960-e459-42c4-962f-41229a2d3783'
      AND role IN ('Admin', 'Manager', 'SuperAdmin')
    ORDER BY id ASC
    LIMIT 1;
  `);
  console.table(tenantAdmin.rows);
  console.log('This is what the Edit modal pre-fills with.');

  console.log('\n=== All auth.users records (Bistro accounts) ===');
  const authUsers = await db.query(`
    SELECT au.id, au.email, au.created_at,
           pu.name, pu.role, pu.restaurant_id
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE pu.restaurant_id = '4c0ed960-e459-42c4-962f-41229a2d3783'
       OR au.email LIKE '%bistro%' OR au.email LIKE '%thebistro%'
    ORDER BY au.created_at;
  `);
  console.table(authUsers.rows);

  console.log('\n=== SCENARIO: What happens when the edit modal saves ===');
  console.log('editUId   =', tenantAdmin.rows[0]?.id);
  console.log('editUEmail=', tenantAdmin.rows[0]?.email);
  console.log('editUPin  =', tenantAdmin.rows[0]?.pin);
  console.log('admin_password = <whatever user typed>');
  console.log('\nThe RPC will update auth.users WHERE id = editUId OR email = editUEmail');

  await db.end();
}

main().catch(console.error);
