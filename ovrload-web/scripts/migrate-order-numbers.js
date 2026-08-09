import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Manually parse .env if it exists
let databaseUrl = process.env.DATABASE_URL;
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) {
      databaseUrl = match[1];
    }
  }
} catch (e) {
  console.log('Error reading .env file:', e.message);
}

const connectionString = databaseUrl || 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

console.log('Connecting to database...');
const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    console.log('Step 1: Adding order_number column...');
    await sql`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS order_number VARCHAR(50) UNIQUE
    `;
    console.log('Column order_number added or already exists.');

    console.log('Step 2: Creating index on order_number...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_order_number 
      ON orders(order_number)
    `;
    console.log('Index idx_orders_order_number created or already exists.');

    console.log('Step 3: Backfilling order_number for existing orders...');
    await sql`
      UPDATE orders 
      SET order_number = to_char(COALESCE(created_at, NOW()) AT TIME ZONE 'Asia/Beirut', 'YYMMDD') || '-' || lpad(id::text, 4, '0') 
      WHERE order_number IS NULL
    `;
    console.log('Backfill complete.');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

run();
