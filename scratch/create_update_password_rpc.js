import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE OR REPLACE FUNCTION public.update_tenant_admin_password(u_user_id uuid, u_email text, u_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF u_password IS NOT NULL AND length(trim(u_password)) > 0 THEN
    UPDATE auth.users
    SET encrypted_password = crypt(u_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE (u_user_id IS NOT NULL AND id = u_user_id) OR (u_email IS NOT NULL AND email = u_email);
  END IF;
  RETURN true;
END;
$$;
`;

async function main() {
  await client.connect();
  await client.query(sql);
  console.log('Successfully created update_tenant_admin_password RPC in Supabase!');
  await client.end();
}

main().catch(console.error);
