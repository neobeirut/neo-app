import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

// Create a helper RPC to get the best tenant admin for a restaurant
// It joins public.users with auth.users to pick the real login account
const sql = `
CREATE OR REPLACE FUNCTION public.get_tenant_admin(p_restaurant_id uuid)
RETURNS TABLE (id uuid, name text, email text, pin text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Strategy 1: Admin/Manager who has an auth.users record (the real login account), oldest first
  RETURN QUERY
  SELECT pu.id, pu.name, pu.email, pu.pin
  FROM public.users pu
  INNER JOIN auth.users au ON au.id = pu.id
  WHERE pu.restaurant_id = p_restaurant_id
    AND pu.role IN ('Admin', 'Manager', 'SuperAdmin')
  ORDER BY au.created_at ASC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Strategy 2: Any Admin/Manager with email set
  RETURN QUERY
  SELECT pu.id, pu.name, pu.email, pu.pin
  FROM public.users pu
  WHERE pu.restaurant_id = p_restaurant_id
    AND pu.role IN ('Admin', 'Manager', 'SuperAdmin')
    AND pu.email IS NOT NULL
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Strategy 3: Any Admin/Manager
  RETURN QUERY
  SELECT pu.id, pu.name, pu.email, pu.pin
  FROM public.users pu
  WHERE pu.restaurant_id = p_restaurant_id
    AND pu.role IN ('Admin', 'Manager', 'SuperAdmin')
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Strategy 4: Any user
  RETURN QUERY
  SELECT pu.id, pu.name, pu.email, pu.pin
  FROM public.users pu
  WHERE pu.restaurant_id = p_restaurant_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_admin TO anon, authenticated, service_role;
`;

async function main() {
  await db.connect();
  console.log('Creating get_tenant_admin RPC...');
  await db.query(sql);
  console.log('Done!');

  // Test it
  const res = await db.query(`SELECT * FROM public.get_tenant_admin('4c0ed960-e459-42c4-962f-41229a2d3783');`);
  console.log('Result for The Bistro:');
  console.table(res.rows);

  const res2 = await db.query(`SELECT * FROM public.get_tenant_admin('79256f11-a9f8-4fec-901d-69baf929762d');`);
  console.log('Result for Neo Beirut:');
  console.table(res2.rows);

  await db.end();
}

main().catch(console.error);
