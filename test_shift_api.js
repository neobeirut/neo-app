import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ibtbcgkkixkglnhhrrpu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFetchSchedules() {
  console.log('Testing select(*, employees(*)) on employee_schedules...');
  const { data, error } = await supabase.from('employee_schedules').select('*, employees(*)');
  if (error) {
    console.error('ERROR with employees(*):', error.message);
  } else {
    console.log('Success with employees(*):', data.length, 'rows');
  }

  console.log('Testing select(*) on employee_schedules...');
  const { data: d2, error: e2 } = await supabase.from('employee_schedules').select('*');
  if (e2) {
    console.error('ERROR with select(*):', e2.message);
  } else {
    console.log('Success with select(*):', d2.length, 'rows');
  }
}

testFetchSchedules();
