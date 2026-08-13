import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = "postgresql://postgres.ibtbcgkkixkglnhhrrpu:KGjvpPGb2O0IZktT@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const createRpcSql = `
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

  -- 1. Find public user ID
  IF p_admin_id IS NOT NULL THEN
    v_user_id := p_admin_id;
  ELSE
    SELECT id INTO v_user_id
    FROM public.users
    WHERE restaurant_id = p_restaurant_id
    ORDER BY id ASC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO public.users (id, name, email, role, branch, departments, pin, restaurant_id)
    VALUES (v_user_id, p_admin_name, v_email, 'Admin', 'All', 'All', p_admin_pin, p_restaurant_id);
  ELSE
    UPDATE public.users
    SET name = COALESCE(p_admin_name, name),
        email = v_email,
        pin = COALESCE(p_admin_pin, pin)
    WHERE id = v_user_id;
  END IF;

  -- 2. Check auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_user_id OR email = v_email
  ) INTO v_auth_exists;

  IF v_auth_exists THEN
    -- Update existing auth user
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
    -- Create missing auth user if password is provided
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
  await client.query(createRpcSql);
  console.log('Created update_tenant_admin_credentials RPC!');
  await client.end();

  // Now test with Supabase SDK
  const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
  const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Testing RPC update for The Bistro restaurant...');
  const bistroRestoId = '4c0ed960-e459-42c4-962f-41229a2d3783';
  const testEmail = 'test@flowonline.me';
  const testPassword = 'NewPassword123!';

  const { data: resData, error: resErr } = await supabase.rpc('update_tenant_admin_credentials', {
    p_restaurant_id: bistroRestoId,
    p_admin_id: null,
    p_admin_name: 'Sami Issa',
    p_admin_email: testEmail,
    p_admin_pin: '1111',
    p_admin_password: testPassword
  });

  console.log('RPC execution result:', resData, resErr ? resErr.message : 'OK');

  console.log('Testing signInWithPassword with test@flowonline.me...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('FAILED to signInWithPassword:', authErr.message);
  } else {
    console.log('SUCCESS! Authenticated user ID:', authData.user?.id, 'Email:', authData.user?.email);
  }
}

main().catch(console.error);
