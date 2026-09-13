import { supabase, setGlobalRestaurantId } from '../../api/supabase';
import { COMMERCE_API_BASE } from '../config';

export interface PosProduct {
  id: string | number;
  name: string;
  description?: string;
  unit_price_usd: number;
  image_url?: string;
  category_id?: string | number;
  category_name?: string;
  sort_order?: number;
  status?: string;
  customizations?: any[];
}

export interface PosCategory {
  id: string | number;
  name: string;
  image_url?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface PosCatalogSettings {
  toters_discount_percent: number;
  noknok_discount_percent: number;
  print_server_ip: string;
  print_server_port: number;
}

export interface PosCatalogResult {
  categories: PosCategory[];
  products: PosProduct[];
  settings: PosCatalogSettings;
  source: 'supabase' | 'commerce_api';
}

const DEFAULT_SETTINGS: PosCatalogSettings = {
  toters_discount_percent: 15,
  noknok_discount_percent: 15,
  print_server_ip: '',
  print_server_port: 9191
};

/**
 * Loads the POS catalog (categories, products, and operational settings)
 * isolated strictly by the active restaurant ID.
 *
 * For restaurants with native menus in Supabase (e.g. The Bistro),
 * loads from `menu_sections` and `menu_recipes`.
 * For brand partners or legacy commerce branches (e.g. Neo Beirut / OVRLOAD),
 * seamlessly routes to the commerce API.
 */
export async function fetchPosCatalog(restaurantId?: string | null): Promise<PosCatalogResult> {
  const activeRid = (restaurantId || '').trim();
  if (activeRid) {
    setGlobalRestaurantId(activeRid);
  }

  // If this is The Bistro or another non-OVRLOAD restaurant, prioritize native Supabase menu
  const isBistro = activeRid === '4c0ed960-e459-42c4-962f-41229a2d3783';

  if (activeRid && isBistro) {
    try {
      const result = await fetchCatalogFromSupabase(activeRid);
      if (result.products.length > 0) {
        return result;
      }
    } catch (err) {
      console.warn('[posCatalogService] Supabase menu query failed, falling back to commerce API:', err);
    }
  }

  // If not Bistro or if Supabase had no products, attempt commerce backend
  try {
    const url = `${COMMERCE_API_BASE}/api/pos/products${activeRid ? `?restaurant_id=${encodeURIComponent(activeRid)}` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {};
    if (activeRid) {
      headers['x-restaurant-id'] = activeRid;
    }

    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        categories: data.categories || [],
        products: data.products || [],
        settings: {
          toters_discount_percent: parseFloat(data.settings?.toters_discount_percent ?? '15'),
          noknok_discount_percent: parseFloat(data.settings?.noknok_discount_percent ?? '15'),
          print_server_ip: data.settings?.print_server_ip || '',
          print_server_port: Number(data.settings?.print_server_port || 9191)
        },
        source: 'commerce_api'
      };
    }
  } catch (commErr) {
    console.warn('[posCatalogService] Commerce API fetch failed, checking Supabase:', commErr);
  }

  // Fallback: If commerce API is unreachable, try Supabase for any restaurant
  if (activeRid) {
    return await fetchCatalogFromSupabase(activeRid);
  }

  return {
    categories: [],
    products: [],
    settings: DEFAULT_SETTINGS,
    source: 'commerce_api'
  };
}

async function fetchCatalogFromSupabase(restaurantId: string): Promise<PosCatalogResult> {
  const [sectionsRes, recipesRes] = await Promise.all([
    supabase
      .from('menu_sections')
      .select('id, name, display_order, is_active')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true }),
    supabase
      .from('menu_recipes')
      .select('id, section_id, item_name, selling_price, image_url, inhouse_image_url, delivery_image_url, recipe_text, is_active')
      .eq('restaurant_id', restaurantId)
      .order('item_name', { ascending: true })
  ]);

  const sectionsData = sectionsRes.data || [];
  const recipesData = recipesRes.data || [];

  const sectionMap = new Map<number, string>();
  const categories: PosCategory[] = sectionsData
    .filter(s => s.is_active !== false)
    .map(s => {
      sectionMap.set(s.id, s.name);
      return {
        id: s.id,
        name: s.name,
        display_order: s.display_order ?? 999,
        is_active: s.is_active !== false
      };
    });

  const products: PosProduct[] = recipesData
    .filter(r => r.is_active !== false)
    .map(r => {
      const price = r.selling_price !== null && r.selling_price !== undefined
        ? parseFloat(String(r.selling_price))
        : 10.0;

      const catName = (r.section_id ? sectionMap.get(r.section_id) : null) || 'General';

      return {
        id: r.id,
        name: r.item_name || 'Unnamed Dish',
        description: r.recipe_text || '',
        unit_price_usd: isNaN(price) ? 10.0 : price,
        image_url: r.inhouse_image_url || r.image_url || r.delivery_image_url || '',
        category_id: r.section_id,
        category_name: catName,
        sort_order: 0,
        status: 'Available',
        customizations: []
      };
    });

  return {
    categories,
    products,
    settings: DEFAULT_SETTINGS,
    source: 'supabase'
  };
}
