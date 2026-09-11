import { supabase } from '../../api/supabase';

export interface PosDiscountRule {
  id: string;
  restaurant_id: string;
  name: string;
  type: 'percent' | 'fixed'; // 'percent' = %, 'fixed' = $ USD
  value: number; // e.g. 20 for 20% or 5.0 for $5
  apply_to_all_branches: boolean;
  branch_ids: string[]; // UUIDs of branches if apply_to_all_branches is false
  branch_names?: string[]; // Cached branch names for display convenience
  is_active: boolean;
  requires_manager_pin?: boolean;
  sort_order?: number;
  color?: string; // Optional accent color (e.g. amber, emerald, blue, rose)
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_DISCOUNT_TEMPLATES = (restaurantId: string): PosDiscountRule[] => [
  {
    id: `disc_staff_${restaurantId.substring(0, 6)}`,
    restaurant_id: restaurantId,
    name: 'Staff Meal',
    type: 'percent',
    value: 20,
    apply_to_all_branches: true,
    branch_ids: [],
    branch_names: [],
    is_active: true,
    requires_manager_pin: false,
    sort_order: 1,
    color: 'emerald'
  },
  {
    id: `disc_vip_${restaurantId.substring(0, 6)}`,
    restaurant_id: restaurantId,
    name: 'VIP Guest',
    type: 'percent',
    value: 10,
    apply_to_all_branches: true,
    branch_ids: [],
    branch_names: [],
    is_active: true,
    requires_manager_pin: false,
    sort_order: 2,
    color: 'blue'
  },
  {
    id: `disc_comp_${restaurantId.substring(0, 6)}`,
    restaurant_id: restaurantId,
    name: 'Manager Comp',
    type: 'percent',
    value: 100,
    apply_to_all_branches: true,
    branch_ids: [],
    branch_names: [],
    is_active: true,
    requires_manager_pin: true,
    sort_order: 3,
    color: 'amber'
  }
];

/**
 * Fetch all discounts configured for the specified restaurant.
 * If none exist, returns default starter templates.
 */
export async function getRestaurantDiscounts(restaurantId: string): Promise<{
  discounts: PosDiscountRule[];
  error?: string;
}> {
  if (!restaurantId) {
    return { discounts: [] };
  }

  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .single();

    if (error) {
      console.warn('[discountService] Could not fetch restaurant settings:', error.message);
      return { discounts: DEFAULT_DISCOUNT_TEMPLATES(restaurantId) };
    }

    const savedDiscounts = data?.settings?.pos_discounts;
    if (Array.isArray(savedDiscounts) && savedDiscounts.length > 0) {
      return { discounts: savedDiscounts };
    }

    // Return default templates if not yet configured
    return { discounts: DEFAULT_DISCOUNT_TEMPLATES(restaurantId) };
  } catch (err: any) {
    console.error('[discountService] Error fetching discounts:', err);
    return { discounts: DEFAULT_DISCOUNT_TEMPLATES(restaurantId), error: err.message };
  }
}

/**
 * Save / replace the list of discounts for the specified restaurant.
 */
export async function saveRestaurantDiscounts(
  restaurantId: string,
  discounts: PosDiscountRule[]
): Promise<{ success: boolean; error?: string }> {
  if (!restaurantId) {
    return { success: false, error: 'Restaurant ID is required' };
  }

  try {
    // 1. Fetch existing settings to preserve all other fields
    const { data, error: getErr } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .single();

    if (getErr) {
      console.warn('[discountService] getErr:', getErr.message);
      return { success: false, error: getErr.message };
    }

    const currentSettings = data?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      pos_discounts: discounts
    };

    // 2. Persist updated settings to Supabase
    const { error: updateErr } = await supabase
      .from('restaurants')
      .update({ settings: updatedSettings })
      .eq('id', restaurantId);

    if (updateErr) {
      console.warn('[discountService] updateErr:', updateErr.message);
      return { success: false, error: updateErr.message };
    }

    console.log('[discountService] saveRestaurantDiscounts SUCCESS for', restaurantId);
    return { success: true };
  } catch (err: any) {
    console.error('[discountService] Error saving discounts:', err);

    return { success: false, error: err.message };
  }
}

/**
 * Filters a list of restaurant discounts to only those applicable to a given branch.
 * A discount applies if:
 * 1. It is marked is_active !== false
 * 2. AND (apply_to_all_branches === true OR its branch_ids includes branchId OR branch_names includes branchName)
 */
export function getApplicableDiscounts(
  allDiscounts: PosDiscountRule[],
  currentBranchId?: string | null,
  currentBranchName?: string | null
): PosDiscountRule[] {
  if (!Array.isArray(allDiscounts)) return [];

  const cleanBranchId = (currentBranchId || '').toLowerCase().trim();
  const cleanBranchName = (currentBranchName || '').toLowerCase().trim();

  return allDiscounts.filter((d) => {
    if (!d.is_active) return false;

    // Global discount applies to all branches
    if (d.apply_to_all_branches) return true;

    // If branch-specific, check branch ID match
    if (cleanBranchId && Array.isArray(d.branch_ids)) {
      if (d.branch_ids.some((id) => id.toLowerCase().trim() === cleanBranchId)) {
        return true;
      }
    }

    // Fallback: check branch name match
    if (cleanBranchName && Array.isArray(d.branch_names)) {
      if (d.branch_names.some((name) => name.toLowerCase().trim() === cleanBranchName)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Calculates the discount dollar amount based on subtotal.
 */
export function calculateDiscountAmount(
  rule: { type: 'percent' | 'fixed'; value: number },
  subtotal: number
): number {
  if (!rule || !subtotal || subtotal <= 0) return 0;
  if (rule.type === 'percent') {
    const pct = Math.max(0, rule.value || 0);
    return parseFloat((subtotal * (pct / 100)).toFixed(2));
  } else {
    const amt = Math.max(0, rule.value || 0);
    return Math.min(subtotal, parseFloat(amt.toFixed(2)));
  }
}
