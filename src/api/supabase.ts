import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[FLOW Config Error] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Configure environment variables explicitly before running.'
  );
}

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
