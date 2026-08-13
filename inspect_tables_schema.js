import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const neoBeirutId = '79256f11-a9f8-4fec-901d-69baf929762d';

const allTables = [
  'ClientComplaints',
  'activity_logs',
  'app_permissions',
  'app_settings',
  'branch_shifts',
  'branches',
  'checklist_submissions',
  'checklists',
  'chef_specials',
  'client_order_attachments',
  'client_order_items',
  'client_order_tasks',
  'client_orders',
  'clients',
  'daily_payments',
  'departments',
  'e_wallets',
  'employees',
  'item_description_mappings',
  'items',
  'login_logs',
  'menu_86',
  'menu_recipes',
  'menu_sections',
  'news',
  'order_items',
  'orders',
  'purchasing_request_items',
  'purchasing_requests',
  'reel_credit_transactions',
  'reservations',
  'restaurants',
  'shift_cash',
  'shift_cash_wallets',
  'sub_departments',
  'supplier_evaluations',
  'supplier_intelligence_config',
  'supplier_quotations',
  'suppliers',
  'tasks',
  'tips_collections',
  'tips_distribution',
  'tips_settings',
  'training_categories',
  'training_documents',
  'training_subcategories',
  'users',
  'void_receipts',
  'waste_logs'
];

async function run() {
  console.log(`Inspecting tables for Neo Beirut (ID: ${neoBeirutId})...\n`);
  
  const tablesWithRestaurantId = [];
  const tablesWithoutRestaurantId = [];
  const errors = [];

  for (const table of allTables) {
    try {
      // Test if column restaurant_id exists by selecting it
      const { data, error } = await supabase
        .from(table)
        .select('restaurant_id')
        .limit(1);

      if (error) {
        if (error.message.includes('column') || error.message.includes('does not exist')) {
          tablesWithoutRestaurantId.push(table);
        } else {
          errors.push({ table, message: error.message });
        }
      } else {
        // Column exists! Now let's count rows for Neo Beirut
        const { count, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', neoBeirutId);
          
        if (countError) {
          errors.push({ table, message: `Count error: ${countError.message}` });
        } else {
          tablesWithRestaurantId.push({ table, count });
        }
      }
    } catch (e) {
      errors.push({ table, message: `Exception: ${e.message}` });
    }
  }

  console.log('--- TABLES WITH restaurant_id ---');
  tablesWithRestaurantId.forEach(({ table, count }) => {
    console.log(`- ${table}: ${count} rows`);
  });

  console.log('\n--- TABLES WITHOUT restaurant_id ---');
  tablesWithoutRestaurantId.forEach(table => {
    console.log(`- ${table}`);
  });

  if (errors.length > 0) {
    console.log('\n--- ERRORS / STORAGE BUCKETS / OTHER ---');
    errors.forEach(({ table, message }) => {
      console.log(`- ${table}: ${message}`);
    });
  }
}

run().catch(console.error);
