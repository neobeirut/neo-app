import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase DB1 (Source - "neo")
const db1Url = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const db1AnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabaseSrc = createClient(db1Url, db1AnonKey);

// Supabase DB2 (Target - Multi-tenant)
const db2Url = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const db2AnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabaseTar = createClient(db2Url, db2AnonKey);

const bistroId = 'd3b0d3b0-d3b0-d3b0-d3b0-d3b0d3b0d3b0';
const logoPath = 'C:\\Users\\fredd\\.gemini\\antigravity\\brain\\38b7ccfa-6b03-44a9-a0c0-0c78192488a1\\media__1784259880214.png';

// Ordered tables to copy (dependencies first)
const tablesToCopy = [
  'departments',
  'sub_departments',
  'branches',
  'suppliers',
  'clients',
  'menu_sections',
  'training_categories',
  'training_subcategories',
  'app_settings',
  'tips_settings',
  'users',
  'app_permissions',
  'employees',
  'items',
  'menu_recipes',
  'checklists',
  'tasks',
  'training_documents',
  'orders',
  'order_items',
  'daily_payments',
  'shift_cash',
  'checklist_submissions',
  'chef_specials',
  'menu_86',
  'ClientComplaints',
  'void_receipts',
  'waste_logs',
  'activity_logs',
  'login_logs',
  'reel_credit_transactions',
  'reservations',
  'tips_collections',
  'tips_distribution',
  'purchasing_requests',
  'purchasing_request_items',
  'branch_shifts'
];

async function run() {
  console.log('=== STARTING DATA COPY FOR "THE BISTRO" ===');

  // 1. Convert logo image to base64
  let base64Logo = null;
  try {
    if (fs.existsSync(logoPath)) {
      console.log('Found logo file, converting to Base64...');
      const fileBuffer = fs.readFileSync(logoPath);
      base64Logo = `data:image/png;base64,${fileBuffer.toString('base64')}`;
      console.log(`Logo encoded successfully (length: ${base64Logo.length} chars)`);
    } else {
      console.log('Logo file not found at path:', logoPath);
    }
  } catch (e) {
    console.error('Error reading logo file:', e.message);
  }

  // 2. Create "The Bistro" restaurant in target DB
  console.log('Creating "The Bistro" restaurant in DB2...');
  const { data: restData, error: restError } = await supabaseTar
    .from('restaurants')
    .upsert({
      id: bistroId,
      name: 'The Bistro',
      logo_url: base64Logo,
      primary_color: '#0a3a2a', // Forest green matching the logo
      settings: {
        enabled_sections: [
          'orders', 'client_orders', 'reservations', 'checklists', 'shift_submissions', 'tasks',
          'catalog', 'purchasing', 'suppliers', 'waste', 'missing_items', 'voids',
          'employees', 'tips', 'permissions', 'signin_logs', 'complaints', 'specials',
          'finance', 'branch_management', 'news', 'sops', 'menu'
        ],
        is_vat_subscribed: true
      }
    })
    .select();

  if (restError) {
    console.error('FAILED to create/update restaurant:', restError.message);
    process.exit(1);
  }
  console.log('Restaurant created/updated successfully:', restData);

  // 3. Copy tables
  for (const table of tablesToCopy) {
    console.log(`\n--- Copying table: ${table} ---`);
    
    // Fetch all records from source DB
    const { data: rows, error: fetchError } = await supabaseSrc
      .from(table)
      .select('*');

    if (fetchError) {
      console.error(`Error fetching from ${table}:`, fetchError.message);
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log(`No records found in source for ${table}. Skipping.`);
      continue;
    }

    console.log(`Fetched ${rows.length} rows from source. Preparing insert...`);

    // Prepare rows by attaching restaurant_id
    const preparedRows = rows.map(row => {
      return {
        ...row,
        restaurant_id: bistroId
      };
    });

    // Insert in batches of 100
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < preparedRows.length; i += batchSize) {
      const batch = preparedRows.slice(i, i + batchSize);
      const { error: insertError } = await supabaseTar
        .from(table)
        .upsert(batch);

      if (insertError) {
        console.error(`Error inserting batch into ${table} (index ${i}-${i + batch.length}):`, insertError.message);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Successfully upserted ${insertedCount}/${rows.length} rows into ${table} in DB2.`);
  }

  console.log('\n=== DATA COPY COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
