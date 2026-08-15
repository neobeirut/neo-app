import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='));
const dbUrl = dbUrlLine.split('=')[1].trim().replace(/^["']|["']$/g, '');

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const products = await sql`SELECT id, name, unit_price_usd FROM products`;
    console.log('--- PRODUCTS ---');
    console.log(JSON.stringify(products, null, 2));

    const ordersCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders'`;
    console.log('--- ORDERS COLUMNS ---');
    console.log(ordersCols.map(c => `${c.column_name}: ${c.data_type}`).join('\n'));

    const itemsCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_items'`;
    console.log('--- ORDER ITEMS COLUMNS ---');
    console.log(itemsCols.map(c => `${c.column_name}: ${c.data_type}`).join('\n'));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
})();
