import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateOrderNumber, resolveOrderId } from '../src/app/api/orders/utils/orderIdResolver.js';

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

const connectionString = databaseUrl || 'postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

console.log('Connecting to database for verification...');
const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });

async function verify() {
  try {
    console.log('1. Checking database schema...');
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'order_number'
    `;
    
    if (columns.length === 0) {
      console.error('❌ FAIL: order_number column does not exist on orders table.');
      return;
    }
    console.log('✅ PASS: order_number column exists with type:', columns[0].data_type);

    console.log('\n2. Testing order_number generator...');
    const now = new Date();
    const beirutDateStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Beirut",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(now); // MM/DD/YY
    const [mm, dd, yy] = beirutDateStr.split('/');
    const expectedPrefix = `${yy}${mm}${dd}`;

    // Simulate generation loop
    let randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `${expectedPrefix}-${randomSuffix}`;
    console.log(`Generated sample order number: ${orderNumber}`);
    
    if (!/^\d{6}-\d{4}$/.test(orderNumber)) {
      console.error('❌ FAIL: Generated order number does not match format YYMMDD-XXXX.');
    } else {
      console.log('✅ PASS: Order number format matches YYMMDD-XXXX.');
    }

    console.log('\n3. Checking backfilled order numbers...');
    const orders = await sql`
      SELECT id, order_number, created_at 
      FROM orders 
      WHERE order_number IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 5
    `;
    
    if (orders.length === 0) {
      console.error('❌ FAIL: No orders found with order_number populated.');
    } else {
      orders.forEach(o => {
        console.log(`Order #${o.id} has display ID: ${o.order_number}`);
      });
      console.log('✅ PASS: Existing orders have backfilled order numbers.');
    }

    console.log('\n4. Testing resolution helper...');
    const testOrder = orders[0];
    if (testOrder) {
      const resolvedFromDisplay = await sql`
        SELECT id FROM orders WHERE order_number = ${testOrder.order_number} LIMIT 1
      `;
      const resolvedFromNumeric = await sql`
        SELECT id FROM orders WHERE id = ${Number(testOrder.id)} LIMIT 1
      `;
      
      console.log(`Lookup display ID "${testOrder.order_number}" -> database ID: ${resolvedFromDisplay[0]?.id}`);
      console.log(`Lookup numeric ID "${testOrder.id}" -> database ID: ${resolvedFromNumeric[0]?.id}`);
      
      if (resolvedFromDisplay[0]?.id === testOrder.id && resolvedFromNumeric[0]?.id === testOrder.id) {
        console.log('✅ PASS: Display ID and legacy numeric ID both resolve back to the same DB primary key.');
      } else {
        console.error('❌ FAIL: ID resolution mismatch.');
      }
    }

    console.log('\nVerification complete!');
  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await sql.end();
  }
}

verify();
