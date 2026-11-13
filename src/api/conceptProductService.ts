import { supabase } from './supabase';
import { getRestaurantId } from './client';

export const DEFAULT_RESTAURANT_ID = '79256f11-a9f8-4fec-901d-69baf929762d';

export const CORE_CONCEPTS = [
  { id: '00000000-0000-0000-0000-000000000001', code: 'NEO', name: 'NÉO (Restaurant, Café, Bakery & Pastry)', color: '#1e5c4f' },
  { id: '00000000-0000-0000-0000-000000000002', code: 'OVRLOAD', name: 'OVRLOAD (Loaded Wraps & Delivery)', color: '#ea580c' },
  { id: '00000000-0000-0000-0000-000000000003', code: 'WICKD', name: 'WICKD (Cinnamon Rolls Brand)', color: '#7c3aed' },
];

export const SALES_CHANNELS = [
  'Pickup / POS',
  'WhatsApp',
  'Toters',
  'NokNok',
  'Direct App'
] as const;

export type SalesChannel = typeof SALES_CHANNELS[number];

export interface ConceptChannelOverride {
  id?: string;
  concept_config_id?: string;
  channel: SalesChannel | string;
  selling_price?: number | null;
  image_url?: string | null;
  description?: string | null;
  is_available?: boolean;
}

export interface ProductConceptConfig {
  id?: string;
  product_id: number;
  concept_id: string;
  display_name: string;
  description?: string;
  selling_price: number;
  main_image_url?: string;
  gallery_image_urls?: string[];
  menu_category_id?: number | null;
  is_visible: boolean;
  is_available: boolean;
  display_order: number;
  is_active: boolean;
  packaging_item_id?: string | null;
  channel_overrides?: Record<string, ConceptChannelOverride>;
}

export interface MasterProductDetails {
  id: number;
  name: string;
  sku?: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: number | null;
  concept_id?: string | null;
  status?: string;
  is_active?: boolean;
  show_in_mobile?: boolean;
}

const LOCAL_STORAGE_KEY = 'flow_concept_product_configs_v1';

function getActiveRid(): string {
  return getRestaurantId() || DEFAULT_RESTAURANT_ID;
}

/**
 * Resolves the effective selling price according to Section 3:
 * 1. Active concept + channel price override
 * 2. Active concept base price
 * 3. Null (unavailable for sale in that concept)
 */
export function resolveEffectiveSellingPrice(
  config: ProductConceptConfig | undefined,
  channel?: string
): number | null {
  if (!config || !config.is_active || !config.is_available) {
    return null;
  }

  if (channel && config.channel_overrides && config.channel_overrides[channel]) {
    const override = config.channel_overrides[channel];
    if (override.is_available === false) return null;
    if (override.selling_price !== undefined && override.selling_price !== null && override.selling_price > 0) {
      return Number(override.selling_price);
    }
  }

  if (config.selling_price !== undefined && config.selling_price !== null && config.selling_price >= 0) {
    return Number(config.selling_price);
  }

  return null;
}

/**
 * Resolves the effective image according to Section 3:
 * 1. Active concept + channel image override
 * 2. Active concept main image
 * 3. Master product default image
 * 4. Standard placeholder
 */
export function resolveEffectiveProductImage(
  config: ProductConceptConfig | undefined,
  channel: string | undefined,
  masterDefaultImage?: string
): string {
  const placeholder = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

  if (config && channel && config.channel_overrides && config.channel_overrides[channel]) {
    const override = config.channel_overrides[channel];
    if (override.image_url && override.image_url.trim()) {
      return override.image_url.trim();
    }
  }

  if (config?.main_image_url && config.main_image_url.trim()) {
    return config.main_image_url.trim();
  }

  if (masterDefaultImage && masterDefaultImage.trim()) {
    return masterDefaultImage.trim();
  }

  return placeholder;
}

export interface RecoveryCandidate {
  productId: number;
  conceptId: string;
  conceptCode: string;
  displayName: string;
  sellingPrice: number;
  menuCategoryId: number | null;
  isAvailable: boolean;
  isActive: boolean;
  channelOverridesCount: number;
  reason: 'missing_in_db' | 'missing_channel_overrides';
  localConfig: ProductConceptConfig;
}

export interface RecoveryPreviewResult {
  hasLocalData: boolean;
  totalLocalEntries: number;
  candidates: RecoveryCandidate[];
  skippedExistingDbCount: number;
}

export interface RecoveryImportResult {
  importedConfigs: number;
  importedOverrides: number;
  skippedExistingDbCount: number;
}

function mapDbRowToConceptConfig(c: any): ProductConceptConfig {
  const overrides: Record<string, ConceptChannelOverride> = {};
  if (Array.isArray(c.concept_channel_product_overrides)) {
    c.concept_channel_product_overrides.forEach((o: any) => {
      overrides[o.channel] = {
        id: o.id,
        concept_config_id: o.concept_config_id,
        channel: o.channel,
        selling_price: o.selling_price !== null && o.selling_price !== undefined ? Number(o.selling_price) : null,
        image_url: o.image_url,
        description: o.description,
        is_available: o.is_available !== false
      };
    });
  }

  return {
    id: c.id,
    product_id: c.product_id,
    concept_id: c.concept_id,
    display_name: c.display_name,
    description: c.description || '',
    selling_price: Number(c.selling_price || 0),
    main_image_url: c.main_image_url || '',
    gallery_image_urls: c.gallery_image_urls || [],
    menu_category_id: c.menu_category_id ?? null,
    is_visible: c.is_visible !== false,
    is_available: c.is_available !== false,
    display_order: c.display_order || 0,
    is_active: c.is_active !== false,
    packaging_item_id: c.packaging_item_id || null,
    channel_overrides: overrides
  };
}

function readLocalStorageConfigsRaw(): Record<string, Record<string, ProductConceptConfig>> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const conceptProductService = {
  /**
   * Loads all concept configurations and channel overrides for a given product ID from Supabase.
   */
  async getProductConfigurations(productId: number, masterProduct?: MasterProductDetails): Promise<Record<string, ProductConceptConfig>> {
    const rid = getActiveRid();
    const result: Record<string, ProductConceptConfig> = {};

    const { data: configs, error } = await supabase
      .from('product_concept_configurations')
      .select(`
        *,
        concept_channel_product_overrides (*)
      `)
      .eq('restaurant_id', rid)
      .eq('product_id', productId);

    if (error) {
      throw new Error(`Failed to load concept configurations from database: ${error.message}`);
    }

    if (configs && configs.length > 0) {
      configs.forEach((c: any) => {
        result[c.concept_id] = mapDbRowToConceptConfig(c);
      });
      return result;
    }

    // No rows in DB yet for this product: initialize unsaved defaults from master product
    if (masterProduct) {
      const defaultConceptId = masterProduct.concept_id || '00000000-0000-0000-0000-000000000001';
      CORE_CONCEPTS.forEach(concept => {
        const isMasterConcept = concept.id === defaultConceptId;
        result[concept.id] = {
          product_id: productId,
          concept_id: concept.id,
          display_name: masterProduct.name,
          description: masterProduct.description || '',
          selling_price: masterProduct.price || 0,
          main_image_url: masterProduct.image_url || '',
          gallery_image_urls: [],
          menu_category_id: masterProduct.category_id,
          is_visible: isMasterConcept,
          is_available: masterProduct.is_active !== false,
          display_order: 0,
          is_active: isMasterConcept,
          channel_overrides: {}
        };
      });
    }

    return result;
  },

  /**
   * Loads all concept configurations and channel overrides for the active restaurant from Supabase (paginated).
   */
  async getAllConfigurations(): Promise<Record<string, Record<string, ProductConceptConfig>>> {
    const rid = getActiveRid();
    const map: Record<string, Record<string, ProductConceptConfig>> = {};
    const pageSize = 500;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('product_concept_configurations')
        .select(`
          *,
          concept_channel_product_overrides (*)
        `)
        .eq('restaurant_id', rid)
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(`Failed to load all concept configurations from database: ${error.message}`);
      }

      if (!data || data.length === 0) break;

      data.forEach((c: any) => {
        const pidKey = String(c.product_id);
        if (!map[pidKey]) map[pidKey] = {};
        map[pidKey][c.concept_id] = mapDbRowToConceptConfig(c);
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return map;
  },

  /**
   * Inspects browser localStorage (`flow_concept_product_configs_v1`) and compares against Supabase
   * without modifying any database records.
   */
  async previewLocalStorageRecovery(): Promise<RecoveryPreviewResult> {
    const localData = readLocalStorageConfigsRaw();
    const productKeys = Object.keys(localData);
    if (productKeys.length === 0) {
      return {
        hasLocalData: false,
        totalLocalEntries: 0,
        candidates: [],
        skippedExistingDbCount: 0
      };
    }

    const dbConfigs = await this.getAllConfigurations();
    const candidates: RecoveryCandidate[] = [];
    let totalLocalEntries = 0;
    let skippedExistingDbCount = 0;

    for (const pidStr of productKeys) {
      const productId = Number(pidStr);
      const conceptMap = localData[pidStr];
      if (!Number.isFinite(productId) || !conceptMap || typeof conceptMap !== 'object') continue;

      for (const conceptId of Object.keys(conceptMap)) {
        const localCfg = conceptMap[conceptId];
        if (!localCfg || typeof localCfg !== 'object') continue;
        totalLocalEntries++;

        const dbCfg = dbConfigs[pidStr]?.[conceptId];
        const localOverrides = localCfg.channel_overrides || {};
        const localOverrideKeys = Object.keys(localOverrides);
        const conceptMeta = CORE_CONCEPTS.find(c => c.id === conceptId);
        const conceptCode = conceptMeta?.code || conceptId.slice(0, 8);

        if (!dbCfg) {
          // Only recover active concepts or configs with explicit overrides so inactive placeholders aren't imported
          if (localCfg.is_active || localOverrideKeys.length > 0) {
            candidates.push({
              productId,
              conceptId,
              conceptCode,
              displayName: localCfg.display_name || `Product #${productId}`,
              sellingPrice: Number(localCfg.selling_price ?? 0),
              menuCategoryId: localCfg.menu_category_id ?? null,
              isAvailable: localCfg.is_available !== false,
              isActive: localCfg.is_active !== false,
              channelOverridesCount: localOverrideKeys.length,
              reason: 'missing_in_db',
              localConfig: localCfg
            });
          } else {
            skippedExistingDbCount++;
          }
          continue;
        }

        // DB row already exists: never overwrite existing DB concept fields or existing channel overrides.
        // Only offer to import channel overrides that are missing in DB.
        const missingOverrides = localOverrideKeys.filter(ch => !dbCfg.channel_overrides?.[ch]);
        if (missingOverrides.length > 0) {
          candidates.push({
            productId,
            conceptId,
            conceptCode,
            displayName: dbCfg.display_name || localCfg.display_name || `Product #${productId}`,
            sellingPrice: Number(dbCfg.selling_price ?? localCfg.selling_price ?? 0),
            menuCategoryId: dbCfg.menu_category_id ?? localCfg.menu_category_id ?? null,
            isAvailable: dbCfg.is_available,
            isActive: dbCfg.is_active,
            channelOverridesCount: missingOverrides.length,
            reason: 'missing_channel_overrides',
            localConfig: {
              ...dbCfg,
              channel_overrides: Object.fromEntries(
                missingOverrides.map(ch => [ch, localOverrides[ch]])
              )
            }
          });
        } else {
          skippedExistingDbCount++;
        }
      }
    }

    return {
      hasLocalData: totalLocalEntries > 0,
      totalLocalEntries,
      candidates,
      skippedExistingDbCount
    };
  },

  /**
   * Controlled one-time import from browser localStorage into Supabase.
   * Never overwrites existing database configurations or existing channel overrides.
   */
  async recoverLocalStorageConfigs(): Promise<RecoveryImportResult> {
    const rid = getActiveRid();
    const preview = await this.previewLocalStorageRecovery();
    let importedConfigs = 0;
    let importedOverrides = 0;

    for (const candidate of preview.candidates) {
      const cfg = candidate.localConfig;
      let conceptConfigId = cfg.id;

      if (candidate.reason === 'missing_in_db') {
        const configPayload = {
          restaurant_id: rid,
          product_id: candidate.productId,
          concept_id: candidate.conceptId,
          display_name: cfg.display_name,
          description: cfg.description || '',
          selling_price: Number(cfg.selling_price ?? 0),
          main_image_url: cfg.main_image_url || '',
          gallery_image_urls: cfg.gallery_image_urls || [],
          menu_category_id: cfg.menu_category_id || null,
          is_visible: cfg.is_visible !== false,
          is_available: cfg.is_available !== false,
          display_order: cfg.display_order || 0,
          is_active: cfg.is_active !== false,
          packaging_item_id: cfg.packaging_item_id || null,
          updated_at: new Date().toISOString()
        };

        const { data: insertedConfig, error: insertError } = await supabase
          .from('product_concept_configurations')
          .upsert(configPayload, { onConflict: 'restaurant_id,product_id,concept_id' })
          .select('id')
          .single();

        if (insertError || !insertedConfig?.id) {
          throw new Error(
            `Recovery failed for product ${candidate.productId} (${candidate.conceptCode}): ${insertError?.message || 'No ID returned'}`
          );
        }

        conceptConfigId = insertedConfig.id;
        importedConfigs++;
      }

      if (conceptConfigId && cfg.channel_overrides) {
        const overrideRows = Object.values(cfg.channel_overrides).map(ov => ({
          restaurant_id: rid,
          concept_config_id: conceptConfigId,
          channel: ov.channel,
          selling_price: ov.selling_price !== null && ov.selling_price !== undefined ? Number(ov.selling_price) : null,
          image_url: ov.image_url || null,
          description: ov.description || null,
          is_available: ov.is_available !== false,
          updated_at: new Date().toISOString()
        }));

        if (overrideRows.length > 0) {
          const { error: overrideError } = await supabase
            .from('concept_channel_product_overrides')
            .upsert(overrideRows, { onConflict: 'concept_config_id,channel' });

          if (overrideError) {
            throw new Error(
              `Recovery failed for channel overrides of product ${candidate.productId} (${candidate.conceptCode}): ${overrideError.message}`
            );
          }
          importedOverrides += overrideRows.length;
        }
      }
    }

    return {
      importedConfigs,
      importedOverrides,
      skippedExistingDbCount: preview.skippedExistingDbCount
    };
  },

  /**
   * Saves concept configurations and channel overrides for a product to Supabase.
   * Throws an explicit error if any database write fails.
   */
  async saveProductConfigurations(
    productId: number,
    configs: Record<string, ProductConceptConfig>
  ): Promise<boolean> {
    const rid = getActiveRid();

    for (const conceptId of Object.keys(configs)) {
      const cfg = configs[conceptId];
      const configPayload = {
        restaurant_id: rid,
        product_id: productId,
        concept_id: conceptId,
        display_name: cfg.display_name,
        description: cfg.description || '',
        selling_price: Number(cfg.selling_price ?? 0),
        main_image_url: cfg.main_image_url || '',
        gallery_image_urls: cfg.gallery_image_urls || [],
        menu_category_id: cfg.menu_category_id || null,
        is_visible: cfg.is_visible,
        is_available: cfg.is_available,
        display_order: cfg.display_order || 0,
        is_active: cfg.is_active,
        packaging_item_id: cfg.packaging_item_id || null,
        updated_at: new Date().toISOString()
      };

      const { data: savedConfig, error: configError } = await supabase
        .from('product_concept_configurations')
        .upsert(configPayload, { onConflict: 'restaurant_id,product_id,concept_id' })
        .select('id')
        .single();

      if (configError || !savedConfig?.id) {
        throw new Error(
          `Database save failed for concept ${conceptId}: ${configError?.message || 'No configuration ID returned'}`
        );
      }

      const configId = savedConfig.id;
      if (cfg.channel_overrides) {
        const overrideRows = Object.values(cfg.channel_overrides).map(ov => ({
          restaurant_id: rid,
          concept_config_id: configId,
          channel: ov.channel,
          selling_price: ov.selling_price !== null && ov.selling_price !== undefined ? Number(ov.selling_price) : null,
          image_url: ov.image_url || null,
          description: ov.description || null,
          is_available: ov.is_available !== false,
          updated_at: new Date().toISOString()
        }));

        if (overrideRows.length > 0) {
          const { error: overrideError } = await supabase
            .from('concept_channel_product_overrides')
            .upsert(overrideRows, { onConflict: 'concept_config_id,channel' });

          if (overrideError) {
            throw new Error(
              `Database save failed for channel overrides (${conceptId}): ${overrideError.message}`
            );
          }
        }
      }
    }

    // Update localStorage strictly as a secondary cache after Supabase persistence succeeds
    try {
      const localData = readLocalStorageConfigsRaw();
      localData[String(productId)] = configs;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localData));
    } catch (e) {
      console.warn('Secondary localStorage cache update failed:', e);
    }

    return true;
  },

  /**
   * Uploads an image to Supabase Storage and returns the public URL
   */
  async uploadProductImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `products/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        // Fallback to general bucket or local data URL
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      // Fallback: convert to base64 data URL
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  }
};
