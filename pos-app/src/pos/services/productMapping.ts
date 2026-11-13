import { supabase } from '../../api/supabase';
import type { CommerceProductLink } from '../types/commerce';

/**
 * In-memory cache for product links to avoid redundant queries during high-frequency POS interactions.
 */
let cachedLinks: CommerceProductLink[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Fetches all active commerce product links for a given platform and restaurant.
 */
export async function getCommerceProductLinks(
  platform: string = 'ovrload',
  forceRefresh: boolean = false
): Promise<CommerceProductLink[]> {
  const now = Date.now();
  if (!forceRefresh && cachedLinks && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedLinks;
  }

  try {
    const { data, error } = await supabase
      .from('commerce_product_links')
      .select('*')
      .eq('platform', platform)
      .eq('active', true);

    if (error || !data) {
      console.error('Error fetching commerce_product_links:', error);
      return cachedLinks || [];
    }

    cachedLinks = data as CommerceProductLink[];
    lastFetchTime = now;
    return cachedLinks;
  } catch (err) {
    console.error('Exception in getCommerceProductLinks:', err);
    return cachedLinks || [];
  }
}

/**
 * Resolves an external commerce product ID (e.g. "1") from a FLOW recipe UUID.
 */
export function resolveCommerceProductByRecipeId(
  recipeId: string,
  links: CommerceProductLink[]
): CommerceProductLink | null {
  if (!recipeId || !links) return null;
  return links.find(l => l.flow_recipe_id === recipeId) || null;
}

/**
 * Resolves a commerce product link by its external product ID (e.g. "1").
 */
export function resolveCommerceProductByExternalId(
  externalProductId: string | number,
  links: CommerceProductLink[]
): CommerceProductLink | null {
  if (!externalProductId || !links) return null;
  const idStr = String(externalProductId);
  return links.find(l => l.external_product_id === idStr) || null;
}
