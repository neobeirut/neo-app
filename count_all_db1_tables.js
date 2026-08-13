import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  console.log('Querying all table counts on DB1...');
  const results = [];
  for (const table of allTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      if (!error.message.includes('schema cache')) {
        results.push({ table, count: 'Error: ' + error.message });
      }
    } else {
      if (count > 0) {
        results.push({ table, count });
      }
    }
  }
  
  console.log('\n--- Tables with data in DB1 ---');
  results.forEach(r => {
    console.log(`- ${r.table}: ${r.count} rows`);
  });
}

run().catch(console.error);
