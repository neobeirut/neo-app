import pg from 'pg';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

// Fixed RPC: 
//  - Look up auth.users by ID only (not OR email) to avoid updating the wrong account
//  - When updating auth.users email, also update the identity record properly
const fixedRpc = `
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

  -- 1. Resolve which public.users record is the tenant admin
  IF p_admin_id IS NOT NULL THEN
    -- Validate the provided admin_id belongs to this restaurant
    IF EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND restaurant_id = p_restaurant_id) THEN
      v_user_id := p_admin_id;
    END IF;
  END IF;

  -- If not found via admin_id, find the primary admin user for this restaurant
  IF v_user_id IS NULL THEN
    -- First: prefer a user who has an email and an auth.users entry
    SELECT pu.id INTO v_user_id
    FROM public.users pu
    INNER JOIN auth.users au ON au.id = pu.id
    WHERE pu.restaurant_id = p_restaurant_id
      AND pu.role IN ('Admin', 'Manager', 'SuperAdmin')
    ORDER BY pu.id ASC
    LIMIT 1;

    -- Second: any admin/manager with email set
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE restaurant_id = p_restaurant_id
        AND role IN ('Admin', 'Manager', 'SuperAdmin')
        AND email IS NOT NULL
      ORDER BY id ASC
      LIMIT 1;
    END IF;

    -- Fallback: any admin/manager
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE restaurant_id = p_restaurant_id
        AND role IN ('Admin', 'Manager', 'SuperAdmin')
      ORDER BY id ASC
      LIMIT 1;
    END IF;

    -- Last resort: any user
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE restaurant_id = p_restaurant_id
      ORDER BY id ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 2. Update public.users
  UPDATE public.users
  SET name = COALESCE(NULLIF(p_admin_name, ''), name),
      email = v_email,
      pin = COALESCE(NULLIF(p_admin_pin, ''), pin),
      role = CASE WHEN role NOT IN ('Admin', 'SuperAdmin') THEN 'Admin' ELSE role END
  WHERE id = v_user_id;

  -- 3. Check if auth.users record exists for this user_id
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_user_id
  ) INTO v_auth_exists;

  IF v_auth_exists THEN
    -- Update existing auth record
    UPDATE auth.users
    SET email = v_email,
        encrypted_password = CASE
          WHEN p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6
          THEN crypt(trim(p_admin_password), gen_salt('bf', 10))
          ELSE encrypted_password
        END,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;

    -- Update identity data
    UPDATE auth.identities
    SET identity_data = json_build_object('sub', v_user_id::text, 'email', v_email)::jsonb,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Insert identity if missing
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (
        gen_random_uuid(), v_user_id,
        json_build_object('sub', v_user_id::text, 'email', v_email)::jsonb,
        'email', v_user_id::text, now(), now(), now()
      );
    END IF;
  ELSE
    -- Create new auth record only if password provided
    IF p_admin_password IS NOT NULL AND length(trim(p_admin_password)) >= 6 THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token,
        is_sso_user, is_anonymous, email_change_confirm_status
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        v_email, crypt(trim(p_admin_password), gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}', '{"email_verified": true}',
        now(), now(), '', '', '', '', '', '', '', '', false, false, 0
      );

      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (
        gen_random_uuid(), v_user_id,
        json_build_object('sub', v_user_id::text, 'email', v_email)::jsonb,
        'email', v_user_id::text, now(), now(), now()
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- Ensure all roles can call this function
GRANT EXECUTE ON FUNCTION public.update_tenant_admin_credentials TO anon, authenticated, service_role;
`;

async function main() {
  await client.connect();
  console.log('Deploying fixed RPC...');
  await client.query(fixedRpc);
  console.log('Done!');
  await client.end();
}

main().catch(console.error);
