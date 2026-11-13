import { supabase, getGlobalRestaurantId } from '../../api/supabase';
import { api } from '../../api/client';

export interface PosVoidReason {
  id: string;
  code: string;
  label: string;
  is_waste: boolean;
  requires_manager: boolean;
  sort_order: number;
}

export const DEFAULT_VOID_REASONS: PosVoidReason[] = [
  { id: 'def-waste', code: 'WASTE', label: 'Waste (Spill / Dropped / Burned)', is_waste: true, requires_manager: true, sort_order: 1 },
  { id: 'def-mind-nowaste', code: 'CHANGE_MIND_NO_WASTE', label: 'Change his mind (no waste)', is_waste: false, requires_manager: true, sort_order: 2 },
  { id: 'def-mind-waste', code: 'CHANGE_MIND_WASTE', label: 'Change his mind (waste)', is_waste: true, requires_manager: true, sort_order: 3 },
  { id: 'def-wrong-nowaste', code: 'WRONG_ITEM_ENTERED', label: 'Wrong item entered (Not made)', is_waste: false, requires_manager: true, sort_order: 4 },
  { id: 'def-wrong-waste', code: 'WRONG_ITEM_PREPARED', label: 'Wrong item prepared (Kitchen waste)', is_waste: true, requires_manager: true, sort_order: 5 },
  { id: 'def-quality', code: 'QUALITY_DEFECT', label: 'Food quality / Taste issue (Waste)', is_waste: true, requires_manager: true, sort_order: 6 },
  { id: 'def-delay', code: 'KITCHEN_DELAY_86', label: 'Kitchen delay / 86 item', is_waste: false, requires_manager: true, sort_order: 7 },
  { id: 'def-dup', code: 'DUPLICATE_ORDER', label: 'Duplicate order', is_waste: false, requires_manager: true, sort_order: 8 },
  { id: 'def-comp', code: 'MANAGER_COMP', label: 'Manager Courtesy / Comp (Waste)', is_waste: true, requires_manager: true, sort_order: 9 }
];

/**
 * Fetch dynamic void reasons from Supabase pos_void_reasons table.
 * Falls back to DEFAULT_VOID_REASONS if table is empty or network is unavailable.
 */
export async function fetchVoidReasons(explicitRestaurantId?: string): Promise<PosVoidReason[]> {
  try {
    const rid = explicitRestaurantId || getGlobalRestaurantId();
    let query = supabase
      .from('pos_void_reasons')
      .select('id, code, label, is_waste, requires_manager, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (rid) {
      query = query.or(`restaurant_id.eq.${rid},restaurant_id.is.null`);
    } else {
      query = query.is('restaurant_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[posVoidService] Could not fetch pos_void_reasons:', error.message);
      return DEFAULT_VOID_REASONS;
    }

    if (data && data.length > 0) {
      const seen = new Set<string>();
      const unique: PosVoidReason[] = [];
      for (const item of data) {
        if (!seen.has(item.code)) {
          seen.add(item.code);
          unique.push(item);
        }
      }
      return unique;
    }
    return DEFAULT_VOID_REASONS;
  } catch (err) {
    console.warn('[posVoidService] Exception fetching void reasons:', err);
    return DEFAULT_VOID_REASONS;
  }
}

/**
 * Check if a given user profile has manager / admin void permission.
 */
export function isManagerAuthorizedForVoid(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin' || role === 'manager') {
    return true;
  }
  if (user.admin_permissions && (user.admin_permissions.voids === true || user.admin_permissions.all === true)) {
    return true;
  }
  return false;
}

/**
 * Verify a manager PIN code against users table.
 */
export async function verifyVoidManagerPin(pin: string): Promise<{
  authorized: boolean;
  managerName?: string;
  managerUser?: any;
  error?: string;
}> {
  if (!pin || pin.trim().length < 4) {
    return { authorized: false, error: 'Please enter a 4-digit Manager PIN.' };
  }

  const res = await api.verifyCashierPin(pin);
  if (!res.success || !res.data) {
    return { authorized: false, error: res.error || 'Invalid Manager PIN code.' };
  }

  const mgr = res.data;
  if (!isManagerAuthorizedForVoid(mgr)) {
    return {
      authorized: false,
      error: `User "${mgr.name}" does not have Manager permission to authorize voids.`
    };
  }

  return {
    authorized: true,
    managerName: mgr.name,
    managerUser: mgr
  };
}
