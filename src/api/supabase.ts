import { createClient } from '@supabase/supabase-js';

const AUTHORITATIVE_URL = 'https://ilrlychrraagugntqdfr.supabase.co';
const AUTHORITATIVE_ANON_KEY = 'sb_publishable_kOFvZiJuLPN9uliL649IHg_Z-CESFMg';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = String((envUrl && !envUrl.includes('ibtbcgkkixkglnhhrrpu')) ? envUrl : AUTHORITATIVE_URL).trim();
const supabaseAnonKey = String((envKey && !envKey.includes('D4nQcvqU') && !envKey.includes('ibtbcgkkixkglnhhrrpu')) ? envKey : AUTHORITATIVE_ANON_KEY).trim();

// Public client – for reads and auth flows (exposed to the browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Clean public client – bypasses user JWT token RLS restrictions for read-only analytics dashboards
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export const DEFAULT_RESTAURANT_ID = '79256f11-a9f8-4fec-901d-69baf929762d';

export const getRestaurantId = (user?: any): string => {
  if (user?.restaurant_id) return user.restaurant_id;
  if (user?.restaurants?.id) return user.restaurants.id;
  return DEFAULT_RESTAURANT_ID;
};
