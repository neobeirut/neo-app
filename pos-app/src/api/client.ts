import { supabase, getGlobalRestaurantId, setGlobalRestaurantId } from './supabase';
import { checkHasPosTerminalAccess } from '../pos/services/posPermissionService';

export function getRestaurantId(): string | null {
  return getGlobalRestaurantId();
}

export function setCachedRestaurantId(id: string | null) {
  setGlobalRestaurantId(id);
}

export function hasAdminAccess(user: any, permissions: any, moduleKey: string, staffFallback: boolean = false): boolean {
  if (!user) return false;
  const role = user.role?.toLowerCase();
  if (role === 'admin' || role === 'superadmin' || role === 'manager') return true;
  if (permissions && typeof permissions[moduleKey] !== 'undefined') {
    return !!permissions[moduleKey];
  }
  return staffFallback;
}

export const api = {
  // Cashier Authentication by PIN
  verifyCashierPin: async (pin: string) => {
    try {
      const cleanPin = pin.trim();
      const restaurantId = getRestaurantId();
      let query = supabase
        .from('users')
        .select('*')
        .or(`pin.eq.${cleanPin},pin_code.eq.${cleanPin}`)
        .eq('is_active', true);

      // Restrict to current restaurant to prevent cross-tenant login
      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        console.error('Error verifying cashier PIN:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Invalid PIN code.' };
      }

      // Verify POS Terminal Access is enabled
      const { data: userPerms } = await supabase.from('app_permissions').select('*');
      if (!checkHasPosTerminalAccess(data, userPerms || [])) {
        return { success: false, error: 'POS Terminal Access is disabled for this account.' };
      }

      let userConcept = data.concept || data.concept_id || undefined;
      let canSwitch = data.can_switch_concepts;

      // Hydrate concept assignment and permissions from restaurants.settings.user_concepts
      try {
        const restId = data.restaurant_id || restaurantId || getRestaurantId();
        if (restId) {
          const { data: restData } = await supabase
            .from('restaurants')
            .select('settings')
            .eq('id', restId)
            .maybeSingle();
          const userConcepts = restData?.settings?.user_concepts;
          if (userConcepts && userConcepts[data.id]) {
            userConcept = userConcepts[data.id].concept || userConcept;
            if (userConcepts[data.id].can_switch_concepts !== undefined) {
              canSwitch = userConcepts[data.id].can_switch_concepts;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to hydrate user concept from restaurant settings:', e);
      }

      return {
        success: true,
        data: {
          id: data.id,
          name: data.display_name || data.name,
          role: data.role || 'cashier',
          branch: data.branch || 'Badaro',
          branch_id: data.branch_id || 1,
          restaurant_id: data.restaurant_id || getRestaurantId(),
          concept: userConcept,
          concept_id: userConcept,
          can_switch_concepts: canSwitch,
          permissions: data.permissions || { can_access_pos: true },
          admin_permissions: data.admin_permissions || {},
          is_super_admin: data.is_super_admin ?? false
        }
      };
    } catch (err: any) {
      console.error('Exception verifying cashier PIN:', err);
      return { success: false, error: err.message };
    }
  },

  // Currency Exchange Rate from System Settings
  getExchangeRate: async (restaurantId?: string) => {
    const rid = restaurantId || getRestaurantId();
    try {
      // 1. Check restaurant-specific settings (System Settings configured in Admin)
      if (rid) {
        const { data: restData, error: restErr } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', rid)
          .maybeSingle();

        if (!restErr && restData?.settings) {
          const settings = restData.settings as any;
          if (settings.exchange_rate !== undefined && Number(settings.exchange_rate) > 0) {
            return { success: true, rate: parseFloat(settings.exchange_rate) };
          }
        }
      }

      // 2. Check app_settings table for 'exchange_rate' or 'exchange_rate_usd_lbp'
      const { data: appData, error: appErr } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['exchange_rate', 'exchange_rate_usd_lbp']);

      if (!appErr && appData && appData.length > 0) {
        const exactRate = appData.find(s => s.setting_key === 'exchange_rate');
        if (exactRate && parseFloat(exactRate.setting_value) > 0) {
          return { success: true, rate: parseFloat(exactRate.setting_value) };
        }
        const fallbackRate = appData.find(s => s.setting_key === 'exchange_rate_usd_lbp');
        if (fallbackRate && parseFloat(fallbackRate.setting_value) > 0) {
          return { success: true, rate: parseFloat(fallbackRate.setting_value) };
        }
      }

      return { success: true, rate: 90000 };
    } catch (err) {
      console.warn('Exception in getExchangeRate:', err);
      return { success: true, rate: 90000 };
    }
  },

  // VAT Configuration from System Settings
  getVatSettings: async (restaurantId?: string) => {
    const rid = restaurantId || getRestaurantId();
    try {
      let isSubscribed = false;
      let vatRate = 11;

      // 1. Check restaurant settings
      if (rid) {
        const { data: restData, error: restErr } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', rid)
          .maybeSingle();

        if (!restErr && restData?.settings) {
          const settings = restData.settings as any;
          if (settings.is_vat_subscribed !== undefined) {
            isSubscribed = settings.is_vat_subscribed === true;
          }
          if (settings.vat_rate !== undefined && Number(settings.vat_rate) >= 0) {
            vatRate = parseFloat(settings.vat_rate);
          }
        }
      }

      // 2. Fallback check from app_settings
      const { data: appData } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['vat_rate', 'is_vat_subscribed']);

      if (appData && appData.length > 0) {
        const appVat = appData.find(s => s.setting_key === 'vat_rate');
        if (appVat && parseFloat(appVat.setting_value) >= 0 && vatRate === 11) {
          vatRate = parseFloat(appVat.setting_value);
        }
        const appSub = appData.find(s => s.setting_key === 'is_vat_subscribed');
        if (appSub && !isSubscribed) {
          isSubscribed = appSub.setting_value === 'true' || appSub.setting_value === '1';
        }
      }

      return { success: true, isVatSubscribed: isSubscribed, vatRate };
    } catch (err) {
      console.warn('Exception in getVatSettings:', err);
      return { success: false, isVatSubscribed: false, vatRate: 11 };
    }
  },

  // Update System Settings (Exchange Rate, VAT Rate, VAT Subscribed)
  updateSystemSettings: async (
    restaurantId: string,
    params: { exchangeRate?: number; vatRate?: number; isVatSubscribed?: boolean }
  ) => {
    try {
      // 1. Update restaurant settings
      if (restaurantId) {
        const { data: restData } = await supabase
          .from('restaurants')
          .select('settings')
          .eq('id', restaurantId)
          .maybeSingle();

        const currentSettings = restData?.settings || {};
        const updatedSettings = {
          ...currentSettings,
          ...(params.exchangeRate !== undefined ? { exchange_rate: params.exchangeRate } : {}),
          ...(params.vatRate !== undefined ? { vat_rate: params.vatRate } : {}),
          ...(params.isVatSubscribed !== undefined ? { is_vat_subscribed: params.isVatSubscribed } : {})
        };

        await supabase
          .from('restaurants')
          .update({ settings: updatedSettings })
          .eq('id', restaurantId);
      }

      // 2. Update app_settings
      if (params.exchangeRate !== undefined) {
        await supabase
          .from('app_settings')
          .upsert({
            setting_key: 'exchange_rate',
            setting_value: String(params.exchangeRate),
            updated_at: new Date().toISOString()
          }, { onConflict: 'setting_key' });
      }
      if (params.vatRate !== undefined) {
        await supabase
          .from('app_settings')
          .upsert({
            setting_key: 'vat_rate',
            setting_value: String(params.vatRate),
            updated_at: new Date().toISOString()
          }, { onConflict: 'setting_key' });
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error updating system settings:', err);
      return { success: false, error: err.message };
    }
  },

  // Branches
  getBranchesList: async (includeInactive = false, explicitRestaurantId?: string) => {
    const rid = explicitRestaurantId || getRestaurantId();
    let query = supabase.from('branches').select('*').order('name');
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  // Restaurant details
  getRestaurantById: async (id: string) => {
    const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Permissions
  getAppPermissions: async (_userName?: string, _departments?: string, _role?: string, userId?: string) => {
    if (!userId) {
      return { success: true, data: { can_access_pos: true, can_manage_settings: true } };
    }
    const { data, error } = await supabase.from('users').select('permissions').eq('id', userId).maybeSingle();
    if (error || !data) {
      return { success: true, data: { can_access_pos: true, can_manage_settings: true } };
    }
    return { success: true, data: data.permissions || {} };
  },

  // ----------------------------------------------------
  // PHASE 12: SUPPLIER INVOICES, PAYMENTS & RECEIVING
  // ----------------------------------------------------
  getSuppliers: async (includeInactive = false) => {
    const rid = getRestaurantId();
    let query = supabase.from('suppliers').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getInventoryLocations: async (branchName?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_locations').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branchName) query = query.eq('branch', branchName);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getItemCatalog: async (search?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('items').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }
    const { data, error } = await query.limit(5000);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getOpenPurchaseOrders: async (supplierId?: string, branchId?: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(name),
        items:purchase_order_items(*)
      `)
      .in('status', ['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED'])
      .order('order_date', { ascending: false });

    if (rid) query = query.eq('restaurant_id', rid);
    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getSupplierPriceLists: async (supplierId?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('supplier_price_lists').select('*').eq('is_active', true);
    if (rid) query = query.eq('restaurant_id', rid);
    if (supplierId) {
      query = query.or(`supplier_id.eq.${supplierId},supplier_id.is.null`);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  postSupplierInvoice: async (payload: any) => {
    const rid = payload.restaurant_id || getRestaurantId();
    const { data, error } = await supabase.rpc('post_pos_supplier_invoice', {
      p_payload: { ...payload, restaurant_id: rid }
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  receiveInvoiceGoods: async (payload: any) => {
    const { data, error } = await supabase.rpc('receive_invoice_goods', {
      p_payload: payload
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  settleSupplierInvoices: async (payload: any) => {
    const rid = payload.restaurant_id || getRestaurantId();
    const { data, error } = await supabase.rpc('settle_supplier_invoices', {
      p_payload: { ...payload, restaurant_id: rid }
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  getSupplierInvoices: async (params?: { supplier_id?: string; branch_id?: string; status?: string }) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('supplier_invoices')
      .select(`
        *,
        supplier:suppliers(name, phone),
        items:supplier_invoice_items(*),
        daily_payments (
          id,
          shift,
          date
        ),
        supplier_payment_allocations (
          payment:supplier_payments (
            pos_shift_id,
            shift_cash (
              id,
              status,
              date,
              shift
            )
          )
        )
      `)
      .order('invoice_date', { ascending: false });

    if (rid) query = query.eq('restaurant_id', rid);
    if (params?.supplier_id && params.supplier_id !== 'All') query = query.eq('supplier_id', params.supplier_id);
    if (params?.branch_id && params.branch_id !== 'All') query = query.eq('branch_id', params.branch_id);
    if (params?.status && params.status !== 'All') query = query.eq('payment_status', params.status);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  deleteSupplierInvoice: async (invoiceId: string, deletedBy?: string) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('delete_pos_supplier_invoice', {
      p_invoice_id: invoiceId,
      p_restaurant_id: rid,
      p_deleted_by: deletedBy || 'POS Cashier'
    });
    if (error) return { success: false, error: error.message };
    return data || { success: true };
  },

  getSupplierPayableLedger: async (supplierId?: string) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('get_supplier_payable_ledger', {
      p_restaurant_id: rid,
      p_supplier_id: supplierId || null
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  postDrawerCashOutflow: async (params: {
    shiftId: string;
    amountUsd: number;
    amountLbp: number;
    outflowType: string;
    expenseCategoryCode?: string;
    payee?: string;
    reason?: string;
    sourceType?: string;
    sourceId?: string;
    authorizedBy?: string;
    createdBy?: string;
    idempotencyKey?: string;
  }) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('post_drawer_cash_outflow', {
      p_restaurant_id: rid,
      p_shift_id: params.shiftId,
      p_amount_usd: params.amountUsd,
      p_amount_lbp: params.amountLbp,
      p_outflow_type: params.outflowType,
      p_expense_category_code: params.expenseCategoryCode || null,
      p_payee: params.payee || null,
      p_reason: params.reason || null,
      p_source_type: params.sourceType || 'GENERAL_EXPENSE',
      p_source_id: params.sourceId || null,
      p_authorized_by: params.authorizedBy || null,
      p_created_by: params.createdBy || 'Cashier',
      p_idempotency_key: params.idempotencyKey || null
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

};
