import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../api/supabase';
import { getCommerceProductLinks, resolveCommerceProductByRecipeId } from '../services/productMapping';
import type { CommerceProductLink } from '../types/commerce';

export interface EnrichedUpsell {
  id: string;
  type: 'upsell' | 'limited';
  recipe_id: string;
  recipe_name: string;
  remaining_qty: number | null;
  product: any; // Actual OVRLOAD sellable product object
}

export function usePosUpsell(branchName: string | undefined, allProducts: any[] = []) {
  const [activeUpsells, setActiveUpsells] = useState<EnrichedUpsell[]>([]);
  const [unmappedUpsells, setUnmappedUpsells] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUpsells = useCallback(async () => {
    if (!branchName || !allProducts || allProducts.length === 0) {
      setActiveUpsells([]);
      return;
    }

    setLoading(true);
    try {
      // 1. Query active chef_specials for this branch
      const { data: specials, error } = await supabase
        .from('chef_specials')
        .select('*')
        .or(`branch.eq.${branchName},branch.eq.All`);

      if (error || !specials || specials.length === 0) {
        setActiveUpsells([]);
        setUnmappedUpsells([]);
        setLoading(false);
        return;
      }

      // 2. Query commerce product links
      const links = await getCommerceProductLinks('ovrload');

      const enriched: EnrichedUpsell[] = [];
      const unmapped: string[] = [];

      for (const sp of specials) {
        // Filter out items with 0 remaining quantity for limited specials
        if (sp.type === 'limited' && sp.remaining_qty !== null && sp.remaining_qty <= 0) {
          continue;
        }

        const link = resolveCommerceProductByRecipeId(sp.recipe_id, links);
        if (!link) {
          console.warn(`[usePosUpsell] Upsell product requires commerce mapping: "${sp.recipe_name}" (recipe_id: ${sp.recipe_id})`);
          unmapped.push(sp.recipe_name);
          continue;
        }

        // Find actual OVRLOAD product
        const actualProduct = allProducts.find(p => String(p.id) === String(link.external_product_id));
        if (!actualProduct) {
          console.warn(`[usePosUpsell] Mapped external product #${link.external_product_id} not found in catalog`);
          unmapped.push(sp.recipe_name);
          continue;
        }

        enriched.push({
          id: sp.id,
          type: sp.type,
          recipe_id: sp.recipe_id,
          recipe_name: sp.recipe_name,
          remaining_qty: sp.remaining_qty,
          product: actualProduct
        });
      }

      setActiveUpsells(enriched);
      setUnmappedUpsells(unmapped);
    } catch (err) {
      console.error('Error in usePosUpsell:', err);
    } finally {
      setLoading(false);
    }
  }, [branchName, allProducts]);

  useEffect(() => {
    fetchUpsells();
  }, [fetchUpsells]);

  return {
    activeUpsells,
    unmappedUpsells,
    loadingUpsell: loading,
    refetchUpsells: fetchUpsells
  };
}
