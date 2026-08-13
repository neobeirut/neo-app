import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const updateRpcSql = `
CREATE OR REPLACE FUNCTION public.update_tenant_admin_credentials(
  p_restaurant_id uuid,
  p_admin_id uuid,
  p_admin_name text,
  p_admin_email text,
  p_admin_pin text,
  p_admin_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_auth_exists boolean;
BEGIN
  v_email := lower(trim(p_admin_email));

  -- 1. Find public user ID: prioritize existing Admin/Manager user for this restaurant
  IF p_admin_id IS NOT NULL THEN
    v_user_id := p_admin_id;
  ELSE
    SELECT id INTO v_user_id
    FROM public.users
    WHERE restaurant_id = p_restaurant_id
      AND role IN ('Admin', 'Manager', 'SuperAdmin')
    ORDER BY id ASC
    LIMIT 1;

    -- Fallback to any user for this restaurant if no Admin exists yet
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE restaurant_id = p_restaurant_id
      ORDER BY id ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO public.users (id, name, email, role, branch, departments, pin, restaurant_id)
    VALUES (v_user_id, COALESCE(p_admin_name, 'Tenant Admin'), v_email, 'Admin', 'All', 'All', COALESCE(p_admin_pin, '1234'), p_restaurant_id);
  ELSE
    UPDATE public.users
    SET name = COALESCE(p_admin_name, name),
        email = v_email,
        pin = COALESCE(p_admin_pin, pin),
        role = 'Admin' -- Ensure Tenant Admin has Admin privileges for Web Dashboard login
    WHERE id = v_user_id;
  END IF;

  -- 2. Sync with auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_user_id OR email = v_email
  ) INTO v_auth_exists;

  IF v_auth_exists THEN
    UPDATE auth.users
    SET email = v_email,
        encrypted_password = CASE 
          WHEN p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 
          THEN crypt(trim(p_admin_password), gen_salt('bf', 10))
          ELSE encrypted_password
        END,
        updated_at = now()
    WHERE id = v_user_id OR email = v_email;

    UPDATE auth.identities
    SET identity_data = json_build_object('sub', v_user_id::text, 'email', v_email),
        updated_at = now()
    WHERE user_id = v_user_id;
  ELSE
    IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token,
        is_sso_user, is_anonymous, email_change_confirm_status
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email,
        crypt(trim(p_admin_password), gen_salt('bf', 10)), now(), 
        '{"provider":"email","providers":["email"]}', '{"email_verified": true}', now(), now(),
        '', '', '', '',
        '', '', '', '',
        false, false, 0
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id, json_build_object('sub', v_user_id::text, 'email', v_email),
        'email', v_user_id::text, now(), now(), now()
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;
`;

async function main() {
  await client.connect();
  await client.query(updateRpcSql);
  console.log('Updated update_tenant_admin_credentials RPC!');

  // Fix role for test@flowonline.me (Sami Issa)
  await client.query(`UPDATE public.users SET role = 'Admin' WHERE email = 'test@flowonline.me' OR id = '14bdd1c1-ae15-4b59-8dfd-eca6f1a84187';`);
  console.log('Updated Sami Issa role to Admin!');

  await client.end();
}

main().catch(console.error);
