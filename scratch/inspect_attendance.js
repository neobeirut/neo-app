import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const adminEmail = 'admin@thebistro.com';
const adminPassword = 'BistroPassword123!';

async function inspect() {
  console.log('1. Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  console.log('Authentication Succeeded!');

  console.log('\n--- Inspecting employees ---');
  const { data: empData, error: empError } = await supabase.from('employees').select('*');
  if (empError) {
    console.error('Error fetching employees:', empError.message);
  } else {
    console.log('Total employees:', empData.length);
    console.log('Employees list:', JSON.stringify(empData.map(e => ({
      employee_id: e.employee_id,
      first_name: e.first_name,
      last_name: e.last_name,
      position: e.position,
      salary_type: e.salary_type,
      salary: e.salary,
      hourly_rate: e.hourly_rate,
      default_daily_hours: e.default_daily_hours,
      working_days_per_week: e.working_days_per_week
    })), null, 2));
  }
}

inspect().catch(console.error);
