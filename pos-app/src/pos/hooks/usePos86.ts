import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../api/supabase';
import { getCommerceProductLinks, resolveCommerceProductByRecipeId } from '../services/productMapping';

export interface Pos86Item {
  name: string;
  type: 'menu' | 'ingredient';
  department?: string;
  recipe_id?: string;
  commerce_product_id?: string;
}

export function usePos86(branchName?: string, conceptId?: string) {
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());
  const [unavailableProductNames, setUnavailableProductNames] = useState<Set<string>>(new Set());
  const [unavailableIngredientNames, setUnavailableIngredientNames] = useState<Set<string>>(new Set());
  const [active86Items, setActive86Items] = useState<Pos86Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [unmapped86Items, setUnmapped86Items] = useState<string[]>([]);

  const effectiveBranch = (branchName && branchName !== 'All') ? branchName.trim() : 'Badaro';

  const fetch86Status = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Fetch active 86 record for branch and concept for TODAY only
      let query = supabase.from('menu_86').select('*');
      if (effectiveBranch) {
        query = query.ilike('branch', effectiveBranch);
      }
      if (conceptId) {
        query = query.or(`concept_id.eq.${conceptId},concept_id.is.null`);
      }
      const { data: records, error } = await query
        .gte('date', `${todayStr}T00:00:00.000Z`)
        .lte('date', `${todayStr}T23:59:59.999Z`)
        .order('date', { ascending: false })
        .limit(1);

      const activeRecord = (records && records.length > 0) ? records[0] : null;
      if (!activeRecord || !Array.isArray(activeRecord.items) || activeRecord.items.length === 0) {
        setUnavailableProductIds(new Set());
        setUnavailableProductNames(new Set());
        setUnavailableIngredientNames(new Set());
        setActive86Items([]);
        setUnmapped86Items([]);
        setLoading(false);
        return;
      }

      // Aggregate active 86 items for today's record
      const rawItemsMap = new Map<string, Pos86Item>();
      for (const it of activeRecord.items) {
        if (it && it.name) {
          const key = `${it.name.toLowerCase().trim()}_${it.type || 'menu'}`;
          if (!rawItemsMap.has(key)) {
            rawItemsMap.set(key, it);
          }
        }
      }
      const rawItems: Pos86Item[] = Array.from(rawItemsMap.values());
      setActive86Items(rawItems);

      // 2. Fetch commerce product links (optional enhancement)
      let links: any[] = [];
      try {
        links = await getCommerceProductLinks('ovrload');
      } catch (linkErr) {
        // Fallback silently if offline or not using commerce links
      }

      const blockedIds = new Set<string>();
      const blockedProductNames = new Set<string>();
      const blockedIngredientNames = new Set<string>();
      const unmapped: string[] = [];

      for (const item of rawItems) {
        const rawName = (item.name || '').trim();
        if (!rawName) continue;
        const normalizedName = rawName.toLowerCase();

        // If it's an ingredient or customization
        if (item.type === 'ingredient') {
          blockedIngredientNames.add(normalizedName);
        } else {
          // It's a menu item / product
          blockedProductNames.add(normalizedName);
          // If marked as menu, also add to ingredients in case a modifier shares the exact name
          blockedIngredientNames.add(normalizedName);
        }

        let resolvedId: string | null = null;

        // Strategy A: Direct commerce_product_id stored on 86 record
        if (item.commerce_product_id) {
          resolvedId = String(item.commerce_product_id);
        }

        // Strategy B: recipe_id mapped via commerce_product_links
        if (!resolvedId && item.recipe_id && links.length > 0) {
          const link = resolveCommerceProductByRecipeId(item.recipe_id, links);
          if (link) {
            resolvedId = String(link.external_product_id);
          }
        }

        // Strategy C: Exact or unique match in commerce_product_links
        if (!resolvedId && links.length > 0) {
          const exactMatch = links.find(l => 
            (l.external_product_name || '').toLowerCase().trim() === normalizedName
          );
          if (exactMatch) {
            resolvedId = String(exactMatch.external_product_id);
          } else if (item.type === 'menu') {
            unmapped.push(item.name);
          }
        }

        if (resolvedId) {
          blockedIds.add(resolvedId);
        }
      }

      setUnavailableProductIds(blockedIds);
      setUnavailableProductNames(blockedProductNames);
      setUnavailableIngredientNames(blockedIngredientNames);
      setUnmapped86Items(unmapped);
    } catch (err) {
      console.error('Error in usePos86:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranch, conceptId]);

  useEffect(() => {
    fetch86Status();

    // Realtime listener on menu_86 table
    const channel = supabase
      .channel(`menu_86_realtime_${effectiveBranch}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_86' },
        () => {
          fetch86Status();
        }
      )
      .subscribe();

    // Periodic poll every 20 seconds as fallback + window focus
    const interval = setInterval(fetch86Status, 20000);
    window.addEventListener('focus', fetch86Status);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('focus', fetch86Status);
    };
  }, [fetch86Status, effectiveBranch]);

  // Check if a product is 86'd (by ID or name with fuzzy normalization)
  const isProduct86d = useCallback((productOrId: any): boolean => {
    if (!productOrId) return false;
    const cleanStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (typeof productOrId === 'object') {
      const pId = String(productOrId.id || productOrId.master_product_id || '');
      if (pId && unavailableProductIds.has(pId)) return true;
      const pName = (productOrId.name || productOrId.display_name || '').trim().toLowerCase();
      if (pName && (unavailableProductNames.has(pName) || unavailableIngredientNames.has(pName))) return true;
      const pClean = cleanStr(pName);
      if (pClean) {
        for (const item of active86Items) {
          const itClean = cleanStr(item.name);
          if (itClean && (itClean === pClean || (itClean.length >= 3 && pClean.includes(itClean)))) {
            return true;
          }
        }
      }
      return false;
    }
    const val = String(productOrId).trim();
    if (unavailableProductIds.has(val)) return true;
    const lower = val.toLowerCase();
    if (unavailableProductNames.has(lower) || unavailableIngredientNames.has(lower)) return true;
    const valClean = cleanStr(lower);
    if (valClean) {
      for (const item of active86Items) {
        const itClean = cleanStr(item.name);
        if (itClean && (itClean === valClean || (itClean.length >= 3 && valClean.includes(itClean)))) {
          return true;
        }
      }
    }
    return false;
  }, [unavailableProductIds, unavailableProductNames, unavailableIngredientNames, active86Items]);

  // Check if a customization option / ingredient is 86'd
  const isCustomization86d = useCallback((optOrName: any): boolean => {
    if (!optOrName) return false;
    const raw = (typeof optOrName === 'string' ? optOrName : (optOrName?.name || optOrName?.ingredient || '')).trim().toLowerCase();
    if (!raw) return false;
    const clean = raw.replace(/\s*\(\s*included\s*\)/gi, '').trim();

    if (unavailableIngredientNames.has(raw) || unavailableIngredientNames.has(clean)) return true;
    if (unavailableProductNames.has(raw) || unavailableProductNames.has(clean)) return true;

    // Word boundary match: e.g. "Feta" matches "Feta Cheese" or "Feta"
    for (const ing of unavailableIngredientNames) {
      if (ing.length >= 3 && clean.includes(ing)) {
        return true;
      }
    }
    return false;
  }, [unavailableIngredientNames, unavailableProductNames]);

  return {
    unavailableProductIds,
    unavailableProductNames,
    unavailableIngredientNames,
    active86Items,
    unmapped86Items,
    isProduct86d,
    isCustomization86d,
    refetch86: fetch86Status,
    loading86: loading
  };
}
