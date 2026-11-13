import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ilrlychrraagugntqdfr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kOFvZiJuLPN9uliL649IHg_Z-CESFMg';

let memoryRestaurantId: string | null = null;

export function setGlobalRestaurantId(id: string | null) {
  memoryRestaurantId = id;
}

export function getGlobalRestaurantId(): string | null {
  if (memoryRestaurantId) return memoryRestaurantId;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const selectedRestId = window.localStorage.getItem('flow_pos_selected_restaurant');
      if (selectedRestId && selectedRestId.trim()) return selectedRestId.trim();

      const cachedUserStr = window.localStorage.getItem('flow_pos_user') || window.localStorage.getItem('neo_admin_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser?.restaurant_id) return cachedUser.restaurant_id;
        if (cachedUser?.restaurants?.id) return cachedUser.restaurants.id;
        if (cachedUser?.restaurantId) return cachedUser.restaurantId;
      }
    }
  } catch {}
  return import.meta.env.VITE_DEFAULT_RESTAURANT_ID || '79256f11-a9f8-4fec-901d-69baf929762d';
}

// Direct public client for Standalone POS
// Auth persistence is disabled: POS uses PIN-based login, NOT Supabase Auth.
// Enabling autoRefreshToken with no auth session causes a crash loop (50k+ errors/session).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
