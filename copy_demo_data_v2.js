import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase DB1 (Source - "neo")
const db1Url = 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const db1AnonKey = 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';
const supabaseSrc = createClient(db1Url, db1AnonKey);

// Supabase DB2 (Target - Multi-tenant)
const db2Url = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const db2AnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabaseTar = createClient(db2Url, db2AnonKey);

const logoPath = 'C:/Users/fredd/.gemini/antigravity/brain/38b7ccfa-6b03-44a9-a0c0-0c78192488a1/media__1784259880214.png';

const adminEmail = 'admin@thebistro.com';
const adminPassword = 'BistroPassword123!';
const adminPin = '1234';
const adminName = 'Bistro Admin';

// Tables to copy in dependency order
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

// ID Mapping dictionary
const idMap = {
  departments: {},
  sub_departments: {},
  branches: {},
  suppliers: {},
  clients: {},
  menu_sections: {},
  training_categories: {},
  training_subcategories: {},
  users: {},
  employees: {},
  items: {},
  menu_recipes: {},
  checklists: {},
  orders: {},
  tips_collections: {},
  purchasing_requests: {}
};

// Helper to suffix text references
function suffixBistro(text) {
  if (!text) return text;
  if (text.includes(' (Bistro)')) return text;
  return `${text} (Bistro)`;
}

// Helper to split and suffix comma-separated lists (e.g. departments list in users)
function suffixCommaList(listStr) {
  if (!listStr) return listStr;
  return listStr.split(',').map(item => suffixBistro(item.trim())).join(', ');
}

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

  let bistroId = null;
  
  // 2. Try to log in first
  console.log(`Checking if admin user ${adminEmail} already exists...`);
  const { data: authData, error: authError } = await supabaseTar.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (authError) {
    console.log('Admin user does not exist in Auth. Creating restaurant and user via RPC...');
    
    // Clean up any existing restaurant named "The Bistro" just in case
    console.log('Cleaning up existing "The Bistro" restaurant if any...');
    await supabaseTar.from('restaurants').delete().eq('name', 'The Bistro');

    const { data: newBistroId, error: rpcError } = await supabaseTar.rpc('create_tenant_admin', {
      r_name: 'The Bistro',
      r_logo: base64Logo || 'https://app.neobeirut.com/logo-512x512.png',
      r_color: '#0a3a2a', // Forest green
      u_name: adminName,
      u_email: adminEmail,
      u_password: adminPassword,
      u_pin: adminPin
    });

    if (rpcError) {
      console.error('Failed to create Bistro tenant and admin via RPC:', rpcError.message);
      process.exit(1);
    }
    
    bistroId = newBistroId;
    console.log('Successfully created "The Bistro" tenant! ID:', bistroId);

    // Authenticate client
    console.log('Authenticating client as Bistro Admin...');
    const { error: authError2 } = await supabaseTar.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (authError2) {
      console.error('Failed to authenticate after RPC:', authError2.message);
      process.exit(1);
    }
  } else {
    console.log('Authentication successful! User ID in Auth schema:', authData.user.id);
    
    // Query users table in public schema
    const { data: userRows, error: userError } = await supabaseTar
      .from('users')
      .select('*')
      .eq('id', authData.user.id);
      
    if (userError) {
      console.error('Failed to query users table:', userError.message);
      process.exit(1);
    }

    if (!userRows || userRows.length === 0) {
      console.log('User profile row missing in public.users. Rebuilding restaurant and profile...');
      
      let targetRestoId = null;
      const { data: existingRestos } = await supabaseTar
        .from('restaurants')
        .select('id')
        .eq('name', 'The Bistro')
        .limit(1);
        
      if (existingRestos && existingRestos.length > 0) {
        targetRestoId = existingRestos[0].id;
        console.log(`Restaurant "The Bistro" already exists with ID: ${targetRestoId}. Reusing it.`);
      } else {
        targetRestoId = crypto.randomUUID();
        console.log(`Inserting restaurant into public.restaurants with ID: ${targetRestoId}...`);
        const { error: insertRestoError } = await supabaseTar
          .from('restaurants')
          .insert({
            id: targetRestoId,
            name: 'The Bistro',
            logo_url: base64Logo,
            primary_color: '#0a3a2a',
            settings: { enabled_sections: [] }
          });
          
        if (insertRestoError) {
          console.error('Failed to insert restaurant:', insertRestoError.message);
          process.exit(1);
        }
      }

      console.log('Inserting user profile into public.users...');
      const { error: insertUserError } = await supabaseTar
        .from('users')
        .insert({
          id: authData.user.id,
          name: adminName,
          email: adminEmail,
          pin: adminPin,
          role: 'Admin',
          branch: 'All',
          departments: 'All',
          restaurant_id: targetRestoId
        });

      if (insertUserError) {
        console.error('Failed to insert user profile:', insertUserError.message);
        process.exit(1);
      }
      
      bistroId = targetRestoId;
      console.log('Successfully rebuilt restaurant and profile. ID:', bistroId);
    } else {
      bistroId = userRows[0].restaurant_id;
      console.log(`Found Bistro Restaurant ID in profile: ${bistroId}`);
      
      // Update logo and details in case logo was updated
      if (base64Logo) {
        console.log('Updating restaurant logo and details...');
        await supabaseTar.from('restaurants').update({
          logo_url: base64Logo,
          primary_color: '#0a3a2a'
        }).eq('id', bistroId);
      }
    }
  }

  // 3. Update restaurant settings (enable all sections and VAT)
  console.log('Updating restaurant configuration settings...');
  const { error: settingsError } = await supabaseTar
    .from('restaurants')
    .update({
      settings: {
        enabled_sections: [
          'orders', 'client_orders', 'reservations', 'checklists', 'shift_submissions', 'tasks',
          'catalog', 'purchasing', 'suppliers', 'price_intelligence', 'waste', 'missing_items', 'voids',
          'employees', 'tips', 'permissions', 'signin_logs', 'complaints', 'specials',
          'finance', 'branch_management', 'news', 'sops', 'menu'
        ],
        is_vat_subscribed: true,
        decryption_key: `neo_sec_${bistroId}_demo_key`
      }
    })
    .eq('id', bistroId);

  if (settingsError) {
    console.error('Failed to update restaurant settings:', settingsError.message);
  }

  // 4. Clean up any existing data for the Bistro restaurant in target DB
  // This is in reverse dependency order to avoid foreign key violations
  console.log('Cleaning up existing restaurant data for Bistro (if any)...');
  const reversedTables = [...tablesToCopy].reverse();
  for (const table of reversedTables) {
    try {
      let query = supabaseTar.from(table).delete().eq('restaurant_id', bistroId);
      if (table === 'users') {
        query = query.neq('id', authData.user.id);
      }
      const { error: delError } = await query;
      if (delError) {
        console.log(`Clean table ${table} error:`, delError.message);
      }
    } catch (e) {
      console.log(`Clean table ${table} exception:`, e.message);
    }
  }

  // Fetch target admin user row in DB2 to preserve it (to prevent deletion/insertion mismatch in public.users)
  const { data: db2Users, error: db2UserError } = await supabaseTar
    .from('users')
    .select('id, email')
    .eq('restaurant_id', bistroId);
    
  if (db2UserError) {
    console.error('Failed to fetch DB2 users:', db2UserError.message);
  }
  const existingUserEmails = new Set(db2Users ? db2Users.map(u => u.email ? u.email.toLowerCase() : null) : []);
  console.log('Preserved target user emails:', Array.from(existingUserEmails));

  // 5. Copy and Map tables
  for (const table of tablesToCopy) {
    console.log(`\n--- Copying and Mapping table: ${table} ---`);

    const { data: srcRows, error: fetchError } = await supabaseSrc
      .from(table)
      .select('*');

    if (fetchError) {
      console.error(`Error fetching from ${table}:`, fetchError.message);
      continue;
    }

    if (!srcRows || srcRows.length === 0) {
      console.log(`No rows in source for ${table}. Skipping.`);
      continue;
    }

    console.log(`Fetched ${srcRows.length} rows from source.`);

    // Map keys and references for this table
    let preparedRows = [];
    for (const row of srcRows) {
      // Avoid inserting admin user again
      if (table === 'users' && row.email && existingUserEmails.has(row.email.toLowerCase())) {
        console.log(`Skipping source user ${row.email} as it matches the newly created admin account.`);
        continue;
      }

      // Deep copy the row so we don't modify the source data
      let newRow = { ...row, restaurant_id: bistroId };

      // Map Primary Key & references
      switch (table) {
        case 'departments':
          idMap.departments[row.id] = row.id + 1000;
          newRow.id = idMap.departments[row.id];
          newRow.name = suffixBistro(row.name);
          break;
          
        case 'sub_departments':
          idMap.sub_departments[row.id] = row.id + 1000;
          newRow.id = idMap.sub_departments[row.id];
          newRow.department_name = suffixBistro(row.department_name);
          break;
          
        case 'branches':
          idMap.branches[row.id] = crypto.randomUUID();
          newRow.id = idMap.branches[row.id];
          newRow.name = suffixBistro(row.name);
          break;
          
        case 'suppliers':
          idMap.suppliers[row.id] = crypto.randomUUID();
          newRow.id = idMap.suppliers[row.id];
          break;
          
        case 'clients':
          idMap.clients[row.id] = crypto.randomUUID();
          newRow.id = idMap.clients[row.id];
          break;
          
        case 'menu_sections':
          idMap.menu_sections[row.id] = row.id + 1000;
          newRow.id = idMap.menu_sections[row.id];
          newRow.department = suffixBistro(row.department);
          break;
          
        case 'training_categories':
          idMap.training_categories[row.id] = crypto.randomUUID();
          newRow.id = idMap.training_categories[row.id];
          break;
          
        case 'training_subcategories':
          idMap.training_subcategories[row.id] = crypto.randomUUID();
          newRow.id = idMap.training_subcategories[row.id];
          newRow.department = suffixBistro(row.department);
          break;
          
        case 'app_settings':
          // settings are global keys (like notifications), so we do NOT map the setting_key.
          // Since it might conflict, we will handle potential duplicate key violations during batch insertion.
          break;
          
        case 'tips_settings':
          // Primary key is likely auto-incrementing integer id or similar
          if (row.id) {
            newRow.id = row.id + 1000;
          }
          newRow.branch = suffixBistro(row.branch);
          break;
          
        case 'users':
          idMap.users[row.id] = crypto.randomUUID();
          newRow.id = idMap.users[row.id];
          newRow.name = suffixBistro(row.name);
          newRow.branch = suffixBistro(row.branch);
          newRow.departments = suffixCommaList(row.departments);
          if (newRow.email) {
            const parts = newRow.email.split('@');
            newRow.email = `${parts[0]}+bistro@${parts[1]}`;
          }
          break;
          
        case 'app_permissions':
          // id is user:userName or dept:deptName.
          // Suffix username or department name to prevent conflicts
          if (row.type === 'user') {
            const userName = row.id.split(':')[1];
            newRow.id = `user:${suffixBistro(userName)}`;
            newRow.name = suffixBistro(row.name);
          } else if (row.type === 'department') {
            const deptName = row.id.split(':')[1];
            newRow.id = `dept:${suffixBistro(deptName)}`;
          }
          break;
          
        case 'employees':
          idMap.employees[row.employee_id] = crypto.randomUUID();
          newRow.employee_id = idMap.employees[row.employee_id];
          newRow.first_name = suffixBistro(row.first_name);
          newRow.branch = suffixBistro(row.branch);
          newRow.department = suffixBistro(row.department);
          break;
          
        case 'items':
          idMap.items[row.id] = crypto.randomUUID();
          newRow.id = idMap.items[row.id];
          newRow.department = suffixBistro(row.department);
          newRow.sub_department = row.sub_department; // sub_departments names are not primary keys, let's keep as-is
          newRow.supplier_id = idMap.suppliers[row.supplier_id] || null;
          break;
          
        case 'menu_recipes':
          idMap.menu_recipes[row.id] = crypto.randomUUID();
          newRow.id = idMap.menu_recipes[row.id];
          newRow.section_id = idMap.menu_sections[row.section_id] || row.section_id;
          break;
          
        case 'checklists':
          idMap.checklists[row.id] = crypto.randomUUID();
          newRow.id = idMap.checklists[row.id];
          newRow.branch = suffixBistro(row.branch);
          newRow.department = suffixBistro(row.department);
          break;
          
        case 'tasks':
          newRow.task_id = `${row.task_id}-Bistro`;
          newRow.branch = suffixBistro(row.branch);
          newRow.department = suffixBistro(row.department);
          break;
          
        case 'training_documents':
          newRow.id = crypto.randomUUID();
          newRow.category_id = idMap.training_categories[row.category_id] || row.category_id;
          break;
          
        case 'orders':
          // ID is a string like ORD-timestamp-BranchName. We make it unique by appending -Bistro
          idMap.orders[row.id] = `${row.id}-Bistro`;
          newRow.id = idMap.orders[row.id];
          newRow.branch = suffixBistro(row.branch);
          newRow.to_branch = suffixBistro(row.to_branch);
          newRow.to_department = suffixBistro(row.to_department);
          newRow.placed_by = suffixBistro(row.placed_by);
          newRow.received_by = suffixBistro(row.received_by);
          newRow.sent_by = suffixBistro(row.sent_by);
          break;
          
        case 'order_items':
          newRow.id = crypto.randomUUID();
          newRow.order_id = idMap.orders[row.order_id] || row.order_id;
          break;
          
        case 'daily_payments':
          newRow.id = crypto.randomUUID();
          newRow.branch = suffixBistro(row.branch);
          newRow.user_name = suffixBistro(row.user_name);
          break;
          
        case 'shift_cash':
          newRow.id = crypto.randomUUID();
          newRow.branch = suffixBistro(row.branch);
          newRow.user_name = suffixBistro(row.user_name);
          break;
          
        case 'checklist_submissions':
          newRow.id = crypto.randomUUID();
          newRow.checklist_id = idMap.checklists[row.checklist_id] || row.checklist_id;
          newRow.user_name = suffixBistro(row.user_name);
          newRow.branch = suffixBistro(row.branch);
          newRow.department = suffixBistro(row.department);
          break;
          
        case 'chef_specials':
          newRow.id = crypto.randomUUID();
          break;
          
        case 'menu_86':
          newRow.id = crypto.randomUUID();
          break;
          
        case 'ClientComplaints':
          newRow.id = crypto.randomUUID();
          newRow.ComplaintID = `${row.ComplaintID}-Bistro`;
          newRow.Branch = suffixBistro(row.Branch);
          newRow.LoggedBy = suffixBistro(row.LoggedBy);
          break;
          
        case 'void_receipts':
          newRow.id = crypto.randomUUID();
          newRow.branch = suffixBistro(row.branch);
          break;
          
        case 'waste_logs':
          newRow.id = crypto.randomUUID();
          newRow.waste_id = `${row.waste_id}-Bistro`;
          newRow.branch = suffixBistro(row.branch);
          newRow.created_by = suffixBistro(row.created_by);
          break;
          
        case 'activity_logs':
          newRow.id = crypto.randomUUID();
          newRow.user_name = suffixBistro(row.user_name);
          break;
          
        case 'login_logs':
          newRow.LogID = `${row.LogID}-Bistro`;
          newRow.UserID = idMap.users[row.UserID] || row.UserID;
          newRow.Branch = suffixBistro(row.Branch);
          newRow.UserName = suffixBistro(row.UserName);
          break;
          
        case 'reel_credit_transactions':
          newRow.id = crypto.randomUUID();
          newRow.branch_name = suffixBistro(row.branch_name);
          newRow.external_id = crypto.randomUUID();
          break;
          
        case 'reservations':
          newRow.id = crypto.randomUUID();
          newRow.branch = suffixBistro(row.branch);
          break;
          
        case 'tips_collections':
          idMap.tips_collections[row.id] = crypto.randomUUID();
          newRow.id = idMap.tips_collections[row.id];
          newRow.tips_id = `${row.tips_id}-Bistro`;
          newRow.branch = suffixBistro(row.branch);
          break;
          
        case 'tips_distribution':
          newRow.id = crypto.randomUUID();
          newRow.tips_collection_id = idMap.tips_collections[row.tips_collection_id] || row.tips_collection_id;
          newRow.employee_id = idMap.employees[row.employee_id] || row.employee_id;
          newRow.employee_name = suffixBistro(row.employee_name);
          break;
          
        case 'purchasing_requests':
          idMap.purchasing_requests[row.id] = crypto.randomUUID();
          newRow.id = idMap.purchasing_requests[row.id];
          newRow.branch = suffixBistro(row.branch);
          break;
          
        case 'purchasing_request_items':
          newRow.id = crypto.randomUUID();
          newRow.purchasing_request_id = idMap.purchasing_requests[row.purchasing_request_id] || row.purchasing_request_id;
          break;
          
        case 'branch_shifts':
          newRow.id = crypto.randomUUID();
          newRow.branch = suffixBistro(row.branch);
          break;
      }

      preparedRows.push(newRow);
    }

    if (preparedRows.length === 0) {
      console.log(`No rows to insert for ${table}. Skipping.`);
      continue;
    }

    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < preparedRows.length; i += batchSize) {
      const batch = preparedRows.slice(i, i + batchSize);
      const { error: insertError } = await supabaseTar
        .from(table)
        .insert(batch);

      if (insertError) {
        if (insertError.message.includes('duplicate key') && table === 'app_settings') {
          console.log(`Skipped duplicate global key in app_settings (expected behavior).`);
        } else {
          console.error(`Error inserting batch into ${table} (index ${i}-${i + batch.length}):`, insertError.message);
        }
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`Successfully inserted ${insertedCount}/${srcRows.length} rows into ${table}.`);
  }

  console.log('\n=== COPY COMPLETE. RUNNING VALIDATION ===');
  // Validate counts
  for (const table of tablesToCopy) {
    const { count, error } = await supabaseTar
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', bistroId);
    if (error) {
      console.log(`- ${table}: Error checking count - ${error.message}`);
    } else {
      console.log(`- ${table}: ${count} rows successfully copied`);
    }
  }

  console.log('\n=== ALL DONE ===');
}

run().catch(console.error);
