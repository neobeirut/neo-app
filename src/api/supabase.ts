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
      const cachedUserStr = window.localStorage.getItem('neo_admin_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        return (
          cachedUser?.restaurant_id ||
          cachedUser?.restaurants?.id ||
          cachedUser?.restaurantId ||
          null
        );
      }
    }
  } catch {}
  return null;
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

