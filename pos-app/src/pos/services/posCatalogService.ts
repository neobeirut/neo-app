import { supabase, setGlobalRestaurantId, getGlobalRestaurantId } from '../../api/supabase';

export interface PosChannelOverride {
  id?: string;
  concept_config_id?: string;
  channel: string;
  selling_price?: number | null;
  image_url?: string | null;
  description?: string | null;
  is_available?: boolean;
}

export interface PosProduct {
  id: string | number;
  master_product_id?: string | number;
  name: string;
  description?: string;
  unit_price_usd: number;
  image_url?: string;
  master_image_url?: string;
  category_id?: string | number;
  category_name?: string;
  concept_id?: string;
  sort_order?: number;
  status?: string;
  customizations?: any[];
  inventory_applies?: boolean;
  inventory_mode?: 'NONE' | 'RECIPE' | 'FINISHED_GOOD';
  quantity_on_hand?: number | null;
  packaging_item_id?: string | null;
  channel_overrides?: Record<string, PosChannelOverride>;
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

/**
 * Resolves the effective POS price according to Section 3:
 * 1. Active concept + channel price override
 * 2. Active concept base price
 */
export function resolveEffectivePosPrice(product: PosProduct, channel?: string | null): number {
  if (!product) return 0;
  if (channel && product.channel_overrides) {
    // Normalise channel search key
    const chClean = channel.trim().toLowerCase();
    const matchKey = Object.keys(product.channel_overrides).find(k => 
      k.toLowerCase() === chClean || 
      (chClean.includes('toter') && k.toLowerCase().includes('toter')) ||
      (chClean.includes('nok') && k.toLowerCase().includes('nok')) ||
      (chClean.includes('what') && k.toLowerCase().includes('what')) ||
      ((chClean.includes('pos') || chClean.includes('pick') || chClean.includes('store')) && (k.toLowerCase().includes('pos') || k.toLowerCase().includes('pick'))) ||
      (chClean.includes('app') && k.toLowerCase().includes('app'))
    );

    if (matchKey) {
      const override = product.channel_overrides[matchKey];
      if (override.selling_price !== undefined && override.selling_price !== null && Number(override.selling_price) > 0) {
        return Number(override.selling_price);
      }
    }
  }

  return Number(product.unit_price_usd || 0);
}

/**
 * Resolves the effective POS image according to Section 3:
 * 1. Active concept + channel image override
 * 2. Active concept main image
 * 3. Master product default image
 * 4. Standard placeholder
 */
export function resolveEffectivePosImage(product: PosProduct, channel?: string | null): string {
  const placeholder = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
  if (!product) return placeholder;

  if (channel && product.channel_overrides) {
    const chClean = channel.trim().toLowerCase();
    const matchKey = Object.keys(product.channel_overrides).find(k => 
      k.toLowerCase() === chClean || 
      (chClean.includes('toter') && k.toLowerCase().includes('toter')) ||
      (chClean.includes('nok') && k.toLowerCase().includes('nok')) ||
      (chClean.includes('what') && k.toLowerCase().includes('what')) ||
      ((chClean.includes('pos') || chClean.includes('pick') || chClean.includes('store')) && (k.toLowerCase().includes('pos') || k.toLowerCase().includes('pick'))) ||
      (chClean.includes('app') && k.toLowerCase().includes('app'))
    );

    if (matchKey) {
      const override = product.channel_overrides[matchKey];
      if (override.image_url && override.image_url.trim()) {
        return override.image_url.trim();
      }
    }
  }

  if (product.image_url && product.image_url.trim()) {
    return product.image_url.trim();
  }

  if (product.master_image_url && product.master_image_url.trim()) {
    return product.master_image_url.trim();
  }

  return placeholder;
}

const DEFAULT_SETTINGS: PosCatalogSettings = {
  toters_discount_percent: 15,
  noknok_discount_percent: 15,
  print_server_ip: '127.0.0.1',
  print_server_port: 9100
};

export async function fetchPosCatalog(
  restaurantId?: string,
  branchId?: string | number,
  conceptId?: string
): Promise<PosCatalogResult> {
  const activeRid = (restaurantId || getGlobalRestaurantId() || '').trim();
  if (activeRid) {
    setGlobalRestaurantId(activeRid);
  }

  if (!activeRid) throw new Error('Restaurant context is required to load the POS catalogue.');
  return await fetchCatalogFromSupabase(activeRid, branchId, conceptId);
}

async function fetchCatalogFromSupabase(
  restaurantId: string,
  branchId?: string | number,
  conceptId?: string
): Promise<PosCatalogResult> {
  try {
    const readAll = async (table: string, configure: (query: any) => any) => {
      const rows: any[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await configure(supabase.from(table).select('*')).order('id').range(offset, offset + 999);
        if (error) throw new Error(table + ': ' + error.message);
        rows.push(...(data || [])); if (!data || data.length < 1000) return { data: rows };
      }
    };

    const [catRes, prodRes, settingsRes, custRes, pbsRes, cItemsRes, restRes] = await Promise.all([
      readAll('categories', q => q.eq('restaurant_id', restaurantId)),
      readAll('products', q => q.eq('restaurant_id', restaurantId)),
      supabase.from('app_settings').select('*'),
      readAll('product_customizations', q => q.eq('restaurant_id', restaurantId).eq('is_active', true)),
      branchId ? readAll('product_branch_status', q => q.eq('restaurant_id', restaurantId).eq('branch_id', String(branchId))) : Promise.resolve({ data: [] }),
      readAll('customization_items', q => q.eq('restaurant_id', restaurantId)),
      supabase.from('restaurants').select('settings').eq('id', restaurantId).maybeSingle()
    ]);

    // Determine target concept ID before querying concept configurations
    const isNeo = !conceptId || conceptId === '00000000-0000-0000-0000-000000000001' || String(conceptId).toUpperCase() === 'NEO';
    const isOvr = conceptId === '00000000-0000-0000-0000-000000000002' || String(conceptId).toUpperCase() === 'OVRLOAD' || String(conceptId).toUpperCase() === 'OVR';
    const isWck = conceptId === '00000000-0000-0000-0000-000000000003' || String(conceptId).toUpperCase() === 'WICKD' || String(conceptId).toUpperCase() === 'WCK';

    const targetConceptId = isOvr
      ? '00000000-0000-0000-0000-000000000002'
      : isWck
        ? '00000000-0000-0000-0000-000000000003'
        : isNeo
          ? '00000000-0000-0000-0000-000000000001'
          : conceptId;

    // Query concept product configurations from Supabase (authoritative source, paginated)
    const conceptConfigs: any[] = [];
    {
      const pageSize = 500;
      let from = 0;
      while (true) {
        const { data: ccData, error: ccErr } = await supabase
          .from('product_concept_configurations')
          .select('*, concept_channel_product_overrides(*)')
          .eq('restaurant_id', restaurantId)
          .eq('concept_id', targetConceptId)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (ccErr) {
          throw new Error(`[posCatalogService] Failed to load product_concept_configurations: ${ccErr.message}`);
        }
        if (!ccData || ccData.length === 0) break;
        conceptConfigs.push(...ccData);
        if (ccData.length < pageSize) break;
        from += pageSize;
      }
    }

    const conceptProductMap = restRes?.data?.settings?.concept_products || {};

    const catData = catRes.data || [];
    const prodData = prodRes.data || [];
    const settingsData = settingsRes.data || [];
    const custData = custRes.data || [];
    const cItemsData = cItemsRes?.data || [];
    const cItemById = new Map<number, any>();
    const cItemByName = new Map<string, any>();
    cItemsData.forEach((ci: any) => {
      cItemById.set(ci.id, ci);
      if (ci.name) cItemByName.set(String(ci.name).trim().toLowerCase(), ci);
    });

    const pbsList = Array.isArray(pbsRes?.data) ? pbsRes.data : [];
    const pbsMap = new Map<number, any>();
    pbsList.forEach((pbs: any) => {
      pbsMap.set(pbs.product_id, pbs);
    });

    const settingsMap: Record<string, string> = {};
    settingsData.forEach((s: any) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    const parsedSettings: PosCatalogSettings = {
      toters_discount_percent: parseFloat(settingsMap.toters_discount_percent || '15'),
      noknok_discount_percent: parseFloat(settingsMap.noknok_discount_percent || '15'),
      print_server_ip: settingsMap.print_server_ip || DEFAULT_SETTINGS.print_server_ip,
      print_server_port: parseInt(settingsMap.print_server_port || String(DEFAULT_SETTINGS.print_server_port), 10)
    };

    const categoryMap = new Map<number | string, string>();
    const categories: PosCategory[] = catData
      .filter((c: any) => c.is_active !== false)
      .sort((a: any, b: any) => (a.display_order ?? 999) - (b.display_order ?? 999))
      .map((c: any) => {
        categoryMap.set(c.id, c.name);
        return {
          id: c.id,
          name: c.name,
          display_order: c.display_order ?? 999,
          is_active: c.is_active !== false
        };
      });

    // Build a map of product_id → customization items
    const custByProduct = new Map<number, any[]>();
    custData.forEach((c: any) => {
      const pid = c.product_id;
      if (!custByProduct.has(pid)) custByProduct.set(pid, []);
      const cItem = (c.customization_item_id ? cItemById.get(c.customization_item_id) : null)
        || cItemByName.get(String(c.ingredient || '').trim().toLowerCase());
      const isDefault = Boolean(c.is_default || cItem?.is_default);

      custByProduct.get(pid)!.push({
        id: c.id,
        product_customization_id: c.id,
        customization_item_id: c.customization_item_id,
        name: c.ingredient,
        ingredient: c.ingredient,
        customization_type: c.customization_type,
        price: c.price || 0,
        option_group_name: c.option_group_name || 'Add On',
        is_required: Boolean(c.is_required),
        is_multi_select: Boolean(c.is_multi_select),
        is_default: isDefault,
        created_at: c.created_at,
      });
    });

    const resolvedProducts: PosProduct[] = [];

    prodData
      .filter((p: any) => p.is_active !== false)
      .forEach((p: any) => {
        const catName = (p.category_id ? categoryMap.get(p.category_id) : null) || 'General';
        const pbs = pbsMap.get(p.id);
        const mode = p.inventory_mode || 'NONE';
        const invApplies = Boolean(p.inventory_applies);
        const legacyStock = mode === 'NONE' && invApplies;
        const qoh = pbs && pbs.quantity_on_hand !== undefined ? pbs.quantity_on_hand : null;

        let status = pbs?.status || p.status || 'Available';
        if (!legacyStock && status === 'OUT_OF_STOCK') status = p.status || 'Available';
        if (legacyStock && qoh !== null && qoh <= 0) {
          status = 'Unavailable Today';
        }

        // 1. Look for concept configuration in Supabase (authoritative source)
        const activeConfig = conceptConfigs.find((c: any) => String(c.product_id) === String(p.id) && c.concept_id === targetConceptId);

        if (activeConfig) {
          // If explicitly configured for this concept
          if (activeConfig.is_active === false) {
            // Disabled in this concept
            return;
          }
          if (activeConfig.is_available === false) {
            status = 'Unavailable Today';
          }

          // Build channel overrides map
          const overrides: Record<string, PosChannelOverride> = {};
          if (Array.isArray(activeConfig.concept_channel_product_overrides)) {
            activeConfig.concept_channel_product_overrides.forEach((ov: any) => {
              overrides[ov.channel] = {
                id: ov.id,
                channel: ov.channel,
                selling_price: ov.selling_price !== null ? Number(ov.selling_price) : null,
                image_url: ov.image_url,
                description: ov.description,
                is_available: ov.is_available !== false
              };
            });
          } else if (activeConfig.channel_overrides && typeof activeConfig.channel_overrides === 'object') {
            Object.keys(activeConfig.channel_overrides).forEach(ch => {
              overrides[ch] = activeConfig.channel_overrides[ch];
            });
          }

          const conceptPrice = Number(activeConfig.selling_price);
          const effectivePrice = !isNaN(conceptPrice) && conceptPrice > 0 ? conceptPrice : Number(p.price || 5.0);

          const resolvedCategoryId = activeConfig.menu_category_id || p.category_id;
          const resolvedCategoryName =
            categories.find(c => String(c.id) === String(resolvedCategoryId))?.name || catName;

          resolvedProducts.push({
            id: p.id,
            master_product_id: p.id,
            name: activeConfig.display_name || p.name || 'Unnamed Dish',
            description: activeConfig.description || p.description || '',
            unit_price_usd: effectivePrice,
            image_url: activeConfig.main_image_url || p.image_url || '',
            master_image_url: p.image_url || '',
            category_id: resolvedCategoryId,
            category_name: resolvedCategoryName,
            concept_id: targetConceptId,
            sort_order: activeConfig.display_order ?? p.display_order ?? 0,
            status,
            customizations: custByProduct.get(p.id) || [],
            inventory_applies: invApplies,
            inventory_mode: mode,
            quantity_on_hand: legacyStock ? qoh : null,
            packaging_item_id: activeConfig.packaging_item_id || null,
            channel_overrides: overrides
          });
          return;
        }

        // 2. Legacy concept routing fallback
        const isCatOvr = catName.toUpperCase().includes('OVRLOAD') || catName.toUpperCase().includes('OVR');
        const isCatWck = catName.toUpperCase().includes('WICKD') || catName.toUpperCase().includes('WCK');
        const mappedConcept = conceptProductMap[String(p.id)] || conceptProductMap[p.id];
        const isDefaultOrEmpty = !p.concept_id || p.concept_id === '00000000-0000-0000-0000-000000000001';
        const legacyResolvedConceptId = isDefaultOrEmpty
          ? (mappedConcept || (isCatOvr ? '00000000-0000-0000-0000-000000000002' : (isCatWck ? '00000000-0000-0000-0000-000000000003' : '00000000-0000-0000-0000-000000000001')))
          : p.concept_id;

        const matchesTarget = (isOvr && legacyResolvedConceptId === '00000000-0000-0000-0000-000000000002') ||
                              (isWck && legacyResolvedConceptId === '00000000-0000-0000-0000-000000000003') ||
                              (isNeo && (legacyResolvedConceptId === '00000000-0000-0000-0000-000000000001' || !legacyResolvedConceptId));

        if (matchesTarget) {
          const numPrice = p.price !== null && p.price !== undefined ? parseFloat(String(p.price)) : NaN;
          const numUnit = p.unit_price_usd !== null && p.unit_price_usd !== undefined ? parseFloat(String(p.unit_price_usd)) : NaN;
          const price = (!isNaN(numPrice) && numPrice > 0)
            ? numPrice
            : (!isNaN(numUnit) && numUnit > 0)
              ? numUnit
              : (!isNaN(numPrice))
                ? numPrice
                : (!isNaN(numUnit) ? numUnit : 5.0);

          resolvedProducts.push({
            id: p.id,
            master_product_id: p.id,
            name: p.name || 'Unnamed Dish',
            description: p.description || '',
            unit_price_usd: isNaN(price) ? 5.0 : price,
            image_url: p.image_url || '',
            master_image_url: p.image_url || '',
            category_id: p.category_id,
            category_name: catName,
            concept_id: targetConceptId,
            sort_order: p.display_order ?? 0,
            status,
            customizations: custByProduct.get(p.id) || [],
            inventory_applies: invApplies,
            inventory_mode: mode,
            quantity_on_hand: legacyStock ? qoh : null,
            channel_overrides: {}
          });
        }
      });

    // Resolve categories that have products in target concept
    const targetCatIds = new Set(resolvedProducts.map(p => String(p.category_id)));
    let resolvedCategories = categories.filter(c => targetCatIds.has(String(c.id)));
    if (resolvedCategories.length === 0 || isNeo) {
      resolvedCategories = categories;
    }

    return {
      categories: resolvedCategories,
      products: resolvedProducts,
      settings: parsedSettings,
      source: 'supabase'
    };
  } catch (err) {
    console.error('[posCatalogService] Failed to load catalog from Supabase:', err);
    throw err;
  }
}
