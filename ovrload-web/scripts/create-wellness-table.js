import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

console.log('Connecting to database...');
const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('Creating wellness_scans table...');
    await sql`
      CREATE TABLE IF NOT EXISTS wellness_scans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        food_name TEXT NOT NULL,
        calories INTEGER NOT NULL,
        protein_g INTEGER NOT NULL,
        carbs_g INTEGER NOT NULL,
        fat_g INTEGER NOT NULL,
        fiber_g INTEGER NOT NULL,
        wellness_score INTEGER NOT NULL,
        ingredients TEXT NOT NULL,
        description TEXT,
        confidence NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('Table wellness_scans created or already exists.');

    console.log('Creating index on user_id...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_wellness_scans_user_id 
      ON wellness_scans (user_id)
    `;
    console.log('Index created successfully.');

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error setting up table:', error);
  } finally {
    await sql.end();
  }
}

run();
