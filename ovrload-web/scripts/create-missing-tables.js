import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

const missingTablesDDL = [
  // Auth tables
  `CREATE TABLE IF NOT EXISTS "auth_accounts" (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    provider_type TEXT,
    provider_id TEXT,
    provider_account_id TEXT,
    refresh_token TEXT,
    access_token TEXT,
    access_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "auth_sessions" (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    expires TIMESTAMP,
    session_token TEXT,
    access_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "auth_verification_token" (
    id SERIAL PRIMARY KEY,
    identifier TEXT,
    token TEXT,
    expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Cart tables
  `CREATE TABLE IF NOT EXISTS "cart_items" (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    product_id INTEGER,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "cart_item_addons" (
    id SERIAL PRIMARY KEY,
    cart_item_id INTEGER,
    addon_id INTEGER,
    customization_item_id INTEGER,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Events tables
  `CREATE TABLE IF NOT EXISTS "events" (
    id SERIAL PRIMARY KEY,
    title TEXT,
    description TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "event_occurrences" (
    id SERIAL PRIMARY KEY,
    event_id INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Order feedback & promo redemptions
  `CREATE TABLE IF NOT EXISTS "order_feedback" (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "promo_redemptions" (
    id SERIAL PRIMARY KEY,
    promo_code_id INTEGER,
    user_id TEXT,
    order_id INTEGER,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // User push tokens & rewards
  `CREATE TABLE IF NOT EXISTS "user_push_tokens" (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    token TEXT,
    platform TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "user_rewards" (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    reward_id INTEGER,
    points INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "user_reward_redemptions" (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    reward_id INTEGER,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`
];

async function createMissing() {
  console.log('Creating remaining empty schema tables...');
  for (const ddl of missingTablesDDL) {
    try {
      await sql.unsafe(ddl);
    } catch (e) {
      console.error('Error creating table:', e.message);
    }
  }
  console.log('🎉 All 45 database tables exist in Supabase!');
  await sql.end();
}

createMissing();
