import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function fixColumns() {
  console.log('Adding catalog_id column to user_rewards table...');
  try {
    await sql`ALTER TABLE user_rewards ADD COLUMN IF NOT EXISTS catalog_id INTEGER;`;
    console.log('✅ Column catalog_id added to user_rewards!');
  } catch (err) {
    console.error('Error adding column:', err.message);
  } finally {
    await sql.end();
  }
}

fixColumns();
