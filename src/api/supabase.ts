import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ibtbcgkkixkglnhhrrpu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm';

let memoryRestaurantId: string | null = null;

export function setGlobalRestaurantId(id: string | null) {
  memoryRestaurantId = id;
}

export function getGlobalRestaurantId(): string | null {
  if (memoryRestaurantId) return memoryRestaurantId;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 1. Direct active restaurant key if set by POS
      const selectedRestId = window.localStorage.getItem('flow_pos_selected_restaurant');
      if (selectedRestId && selectedRestId.trim()) return selectedRestId.trim();

      // 2. Active branch key if set by POS
      const selectedBranch = window.localStorage.getItem('flow_pos_selected_branch') || '';
      if (selectedBranch.toLowerCase().includes('bistro')) {
        return '4c0ed960-e459-42c4-962f-41229a2d3783';
      }

      // 3. User session from neo_admin_user
      const cachedUserStr = window.localStorage.getItem('neo_admin_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser?.restaurant_id) return cachedUser.restaurant_id;
        if (cachedUser?.restaurants?.id) return cachedUser.restaurants.id;
        if (cachedUser?.restaurantId) return cachedUser.restaurantId;
        if (
          cachedUser?.email?.toLowerCase().includes('bistro') ||
          cachedUser?.branch?.toLowerCase().includes('bistro') ||
          cachedUser?.name?.toLowerCase().includes('bistro') ||
          cachedUser?.role?.toLowerCase().includes('bistro')
        ) {
          return '4c0ed960-e459-42c4-962f-41229a2d3783';
        }
        if (cachedUser?.id || cachedUser?.email || cachedUser?.name) {
          return '79256f11-a9f8-4fec-901d-69baf929762d';
        }
      }
    }
  } catch {}
  return '79256f11-a9f8-4fec-901d-69baf929762d';
}


const tenantFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const rid = getGlobalRestaurantId();
  if (!rid) return fetch(input, init);

  if (typeof Request !== 'undefined' && input instanceof Request) {
    const headers = new Headers(input.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    headers.set('x-restaurant-id', rid);
    return fetch(new Request(input, { ...init, headers }));
  }

  const headers = new Headers(init?.headers);
  headers.set('x-restaurant-id', rid);
  return fetch(input, { ...init, headers });
};

// Public client – for reads and auth flows (exposed to the browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: tenantFetch }
});

// Clean public client – bypasses user JWT token RLS restrictions for read-only analytics dashboards
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: tenantFetch }
});

