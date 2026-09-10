import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../api/supabase';
import { getCommerceProductLinks, resolveCommerceProductByRecipeId } from '../services/productMapping';
import type { CommerceProductLink } from '../types/commerce';

export interface Pos86Item {
  name: string;
  type: 'menu' | 'ingredient';
  department?: string;
  recipe_id?: string;
  commerce_product_id?: string;
}

export function usePos86(branchName?: string) {
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());
  const [active86Items, setActive86Items] = useState<Pos86Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [unmapped86Items, setUnmapped86Items] = useState<string[]>([]);

  const fetch86Status = useCallback(async () => {
    if (!branchName) {
      setUnavailableProductIds(new Set());
      setActive86Items([]);
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Fetch active 86 record for today or latest
      const { data: records, error } = await supabase
        .from('menu_86')
        .select('*')
        .eq('branch', branchName)
        .order('date', { ascending: false })
        .limit(1);

      if (error || !records || records.length === 0) {
        setUnavailableProductIds(new Set());
        setActive86Items([]);
        setUnmapped86Items([]);
        setLoading(false);
        return;
      }

      const latestRecord = records[0];
      const rawItems: Pos86Item[] = Array.isArray(latestRecord.items) ? latestRecord.items : [];
      setActive86Items(rawItems);

      // 2. Fetch commerce product links
      const links = await getCommerceProductLinks('ovrload');

      const blockedIds = new Set<string>();
      const unmapped: string[] = [];

      for (const item of rawItems) {
        // Only consider menu items (ingredients don't directly block whole products unless mapped)
        if (item.type && item.type !== 'menu') continue;

        let resolvedId: string | null = null;

        // Strategy A: Direct commerce_product_id stored on 86 record
        if (item.commerce_product_id) {
          resolvedId = String(item.commerce_product_id);
        }

        // Strategy B: recipe_id mapped via commerce_product_links
        if (!resolvedId && item.recipe_id) {
          const link = resolveCommerceProductByRecipeId(item.recipe_id, links);
          if (link) {
            resolvedId = String(link.external_product_id);
          }
        }

        // Strategy C: Historic fallback for records with only display name
        if (!resolvedId && item.name) {
          const normalizedName = item.name.toLowerCase().trim();
          // Find exact or unique match in commerce_product_links
          const exactMatch = links.find(l => 
            l.external_product_name.toLowerCase().trim() === normalizedName
          );
          if (exactMatch) {
            resolvedId = String(exactMatch.external_product_id);
          } else {
            // Flag record as unmapped rather than blindly blocking uncertain products
            unmapped.push(item.name);
          }
        }

        if (resolvedId) {
          blockedIds.add(resolvedId);
        }
      }

      setUnavailableProductIds(blockedIds);
      setUnmapped86Items(unmapped);
    } catch (err) {
      console.error('Error in usePos86:', err);
    } finally {
      setLoading(false);
    }
  }, [branchName]);

  useEffect(() => {
    fetch86Status();
  }, [fetch86Status]);

  const isProduct86d = useCallback((productId: string | number): boolean => {
    if (!productId) return false;
    return unavailableProductIds.has(String(productId));
  }, [unavailableProductIds]);

  return {
    unavailableProductIds,
    active86Items,
    unmapped86Items,
    isProduct86d,
    refetch86: fetch86Status,
    loading86: loading
  };
}
