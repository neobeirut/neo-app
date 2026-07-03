import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dybtzulafvtyfuqwsvkk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hKaJMyrM0bQU7kRKgVplWg_bN2zzirF';

// Public client – for reads and auth flows (exposed to the browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// NOTE: Service‑role client removed from browser bundle to avoid multiple GoTrueClient warnings.
