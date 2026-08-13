import { createClient } from '@supabase/supabase-js';

// Supabase DB2 (Target - Multi-tenant)
const db2Url = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const db2AnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(db2Url, db2AnonKey);

function supabaseUrl() {
  return db2Url;
}

const tablesToDelete = [
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
  console.log('=== FINDING "TEMP TEST BISTRO" ===');
  
  const { data: restos, error: restoError } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('name', 'Temp Test Bistro');
    
  if (restoError) {
    console.error('Error fetching restaurant:', restoError.message);
    process.exit(1);
  }
  
  if (!restos || restos.length === 0) {
    console.log('Restaurant "Temp Test Bistro" not found. Nothing to delete.');
    return;
  }
  
  const tempBistroId = restos[0].id;
  console.log(`Found "Temp Test Bistro" with ID: ${tempBistroId}`);
  
  console.log('\n=== DELETING ASSOCIATED DATA ===');
  const reversedTables = [...tablesToDelete].reverse();
  for (const table of reversedTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .eq('restaurant_id', tempBistroId);
        
      if (error) {
        console.log(`- ${table}: Error deleting data: ${error.message}`);
      } else {
        console.log(`- ${table}: Deleted successfully`);
      }
    } catch (e) {
      console.log(`- ${table}: Exception during delete: ${e.message}`);
    }
  }
  
  console.log('\n=== DELETING RESTAURANT RECORD ===');
  const { error: delRestoError } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', tempBistroId);
    
  if (delRestoError) {
    console.error('Error deleting restaurant record:', delRestoError.message);
  } else {
    console.log('Successfully deleted restaurant "Temp Test Bistro"!');
  }
  
  console.log('=== DONE ===');
}

run().catch(console.error);
