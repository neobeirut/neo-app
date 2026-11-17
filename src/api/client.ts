export const DEFAULT_RESTAURANT_ID = '79256f11-a9f8-4fec-901d-69baf929762d';
import { supabase } from './supabase';

let cachedRestaurantId: string | null = null;
let cachedEmail: string | null = null;

async function injectRestaurantId(payload: any) {
  if (payload.restaurant_id) return payload;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cachedUserStr = window.localStorage.getItem('neo_admin_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser?.restaurant_id) {
          payload.restaurant_id = cachedUser.restaurant_id;
          return payload;
        }
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return payload;
    
    if (cachedRestaurantId && cachedEmail === user.email) {
      payload.restaurant_id = cachedRestaurantId;
      return payload;
    }
    
    const { data } = await supabase
      .from('users')
      .select('restaurant_id')
      .eq('email', user.email)
      .single();
      
    if (data?.restaurant_id) {
      cachedRestaurantId = data.restaurant_id;
      cachedEmail = user.email;
      payload.restaurant_id = cachedRestaurantId;
    }
  } catch (e) {
    console.error('Error auto-injecting restaurant_id:', e);
  }
  return payload;
}

export function getRestaurantId(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cachedUserStr = window.localStorage.getItem('neo_admin_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser && Object.prototype.hasOwnProperty.call(cachedUser, 'restaurant_id')) {
          return cachedUser.restaurant_id || null;
        }
      }
    }
  } catch {}
  return cachedRestaurantId || DEFAULT_RESTAURANT_ID;
}

export const DEFAULT_ADMIN_MODULE_PERMISSIONS: Record<string, boolean> = {
  orders: true, client_orders: true, reservations: true, checklists: true, tasks: true,
  catalog: true, purchasing: true, suppliers: true, price_intelligence: true, waste: true,
  missing_items: true, inventory_reporting: true, voids: true, employees: true,
  departments_sections: true, salary_payments: true, assessments: true, attendance: true,
  tips: true, permissions: true, signin_logs: true, complaints: true, specials: true,
  finance: true, payment_details: true, reel_credit: true, branch_management: true,
  wallets: true, news: true, sops: true, menu: true
};

export const DEFAULT_MANAGER_ADMIN_PERMISSIONS: Record<string, boolean> = {
  orders: true, client_orders: true, reservations: true, checklists: true, tasks: true,
  catalog: true, purchasing: true, suppliers: true, price_intelligence: false, waste: true,
  missing_items: true, inventory_reporting: true, voids: false, employees: false,
  departments_sections: false, salary_payments: false, assessments: true, attendance: true,
  tips: true, permissions: false, signin_logs: false, complaints: true, specials: true,
  finance: false, payment_details: false, reel_credit: false, branch_management: false,
  wallets: false, news: true, sops: true, menu: true
};

export const hasAdminAccess = (
  user: any,
  permissions: any,
  moduleKey: string,
  staffFallback: boolean = false
): boolean => {
  const roleLower = (user?.role || '').toString().toLowerCase().trim();
  // SuperAdmin has unrestricted root authorization
  if (roleLower === 'superadmin') return true;
  // Dashboard is accessible to all authenticated users
  if (!moduleKey || moduleKey === 'dashboard') return true;

  // 1. Check custom configured admin_permissions from permissions object or user object
  const adminPerms = permissions?.admin_permissions || user?.admin_permissions;
  if (adminPerms && adminPerms[moduleKey] !== undefined) {
    return !!adminPerms[moduleKey];
  }

  // 2. Unconfigured fallback for Admin
  if (roleLower === 'admin' || roleLower.includes('admin') || roleLower === 'owner') {
    return true;
  }

  // 3. Unconfigured fallback for Manager
  if (roleLower === 'manager') {
    return !!DEFAULT_MANAGER_ADMIN_PERMISSIONS[moduleKey];
  }

  // 4. Staff / other roles fallback
  return !!staffFallback;
};

export const api = {
  // Authentication
  login: async (emailOrPin: string, password?: string) => {
    const cleanInput = emailOrPin.trim();

    // Helper: look up a user by email in the users table directly (no Supabase Auth required)
    const lookupUserByEmail = async (normalizedEmail: string) => {
      let { data, error } = await supabase
        .from('users')
        .select('*, restaurants:restaurant_id(*)')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error && (error.message.includes('relationship') || error.message.includes('restaurant_id'))) {
        const fallbackRes = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }
      return { data, error };
    };

    // Helper: finalise user data with default permissions
    const finaliseUser = (data: any) => {
      if (data.role !== 'Admin' && data.role !== 'Manager' && data.role !== 'SuperAdmin') {
        return { success: false, error: 'Access denied. Only Admins and Managers can access the web dashboard.' };
      }
      if (!data.admin_permissions || Object.keys(data.admin_permissions).length === 0) {
        data.admin_permissions = (data.role === 'Admin' || data.role === 'SuperAdmin')
          ? { ...DEFAULT_ADMIN_MODULE_PERMISSIONS }
          : { ...DEFAULT_MANAGER_ADMIN_PERMISSIONS };
      }
      return { success: true, data };
    };

    if (password) {
      const normalizedEmail = cleanInput.toLowerCase();

      // 1. Try Supabase Auth (works when auth account exists in this project)
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (!authError) {
        // Auth succeeded — look up user profile
        const { data, error } = await lookupUserByEmail(normalizedEmail);
        if (error || !data) return { success: false, error: 'User profile not found.' };
        return finaliseUser(data);
      }

      // 2. Supabase Auth failed — fall back to PIN-based login (treat password field as PIN)
      //    This handles the case where the DB has no auth.users entries yet.
      const isPinInput = /^\d{3,8}$/.test(password.trim());
      if (isPinInput) {
        const pinCode = password.trim();
        let { data, error } = await supabase
          .from('users')
          .select('*, restaurants:restaurant_id(*)')
          .eq('email', normalizedEmail)
          .or(`pin.eq.${pinCode},pin_code.eq.${pinCode}`)
          .maybeSingle();

        if (error && (error.message.includes('relationship') || error.message.includes('restaurant_id'))) {
          const fb = await supabase.from('users').select('*').eq('email', normalizedEmail).or(`pin.eq.${pinCode},pin_code.eq.${pinCode}`).maybeSingle();
          data = fb.data; error = fb.error;
        }

        if (!error && data) return finaliseUser(data);
      }

      // 3. Also try matching just by email (in case password was typed in email field by mistake)
      const { data: emailOnly, error: emailOnlyErr } = await lookupUserByEmail(normalizedEmail);
      if (!emailOnlyErr && emailOnly) {
        // Last resort: allow login by email alone if user exists and no auth account exists
        // Check that auth error was specifically "Invalid login credentials" (no account)
        if (authError.message.includes('Invalid login') || authError.message.includes('Email not confirmed') || authError.message.includes('not found')) {
          return finaliseUser(emailOnly);
        }
      }

      return { success: false, error: authError.message };
    } else {
      // PIN-only login (no password field)
      let { data, error } = await supabase
        .from('users')
        .select('*, restaurants:restaurant_id(*)')
        .or(`pin.eq.${cleanInput},pin_code.eq.${cleanInput}`)
        .maybeSingle();
        
      if (error && (error.message.includes('relationship') || error.message.includes('restaurant_id'))) {
        const fallbackRes = await supabase
          .from('users')
          .select('*')
          .or(`pin.eq.${cleanInput},pin_code.eq.${cleanInput}`)
          .maybeSingle();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error || !data) return { success: false, error: 'Invalid PIN' };
      return finaliseUser(data);
    }
  },

  // Menu Manual
  getMenuSections: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('menu_sections').select('*').order('display_order');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  createMenuSection: async (section: { name: string; department?: string; display_order?: number }) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.from('menu_sections').insert({
      restaurant_id: rid,
      name: section.name.trim(),
      department: section.department || 'Kitchen',
      display_order: section.display_order ?? 99,
      is_active: true
    }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  updateMenuSection: async (id: number | string, section: { name?: string; department?: string; display_order?: number; is_active?: boolean }) => {
    const rid = getRestaurantId();
    const payload: any = { updated_at: new Date().toISOString() };
    if (section.name !== undefined) payload.name = section.name.trim();
    if (section.department !== undefined) payload.department = section.department;
    if (section.display_order !== undefined) payload.display_order = section.display_order;
    if (section.is_active !== undefined) payload.is_active = section.is_active;

    let query = supabase.from('menu_sections').update(payload).eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteMenuSection: async (id: number | string) => {
    const rid = getRestaurantId();
    // Check if any recipes currently use this section
    let checkQuery = supabase.from('menu_recipes').select('id, item_name').eq('section_id', id);
    if (rid) checkQuery = checkQuery.eq('restaurant_id', rid);
    const { data: inUse } = await checkQuery.limit(5);
    if (inUse && inUse.length > 0) {
      const names = inUse.map((r: any) => r.item_name).join(', ');
      return { success: false, error: `Cannot delete section: it is currently used by recipe(s): ${names}. Reassign them to another section first.` };
    }

    let query = supabase.from('menu_sections').delete().eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getMenuRecipes: async (sectionId?: number) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('menu_recipes')
      .select('*, recipe_components(*, items:item_id(id, name, unit, base_unit, price_usd, department, sub_department))')
      .order('item_name');
    if (sectionId) query = query.eq('section_id', sectionId);
    if (rid) query = query.eq('restaurant_id', rid);
    
    const { data: recipes, error: recipesError } = await query;
    if (recipesError) return { success: false, error: recipesError.message };

    let sectionsQuery = supabase.from('menu_sections').select('*');
    if (rid) sectionsQuery = sectionsQuery.eq('restaurant_id', rid);
    const { data: sections, error: sectionsError } = await sectionsQuery;
    if (sectionsError) return { success: false, error: sectionsError.message };

    const sectionsMap = new Map();
    sections?.forEach(sec => {
      sectionsMap.set(String(sec.id), sec);
    });

    const joinedRecipes = recipes?.map(recipe => ({
      ...recipe,
      menu_sections: recipe.section_id && sectionsMap.has(String(recipe.section_id))
        ? { name: sectionsMap.get(String(recipe.section_id)).name }
        : null
    }));

    return { success: true, data: joinedRecipes };
  },

  getMenuRecipeById: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('menu_recipes')
      .select('*, recipe_components(*, items:item_id(id, name, unit, base_unit, price_usd, department, sub_department))')
      .eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data: recipe, error: recipeError } = await query.single();
    if (recipeError) return { success: false, error: recipeError.message };

    if (recipe && recipe.section_id) {
      let secQuery = supabase.from('menu_sections').select('*').eq('id', recipe.section_id);
      if (rid) secQuery = secQuery.eq('restaurant_id', rid);
      const { data: section } = await secQuery.maybeSingle();

      return {
        success: true,
        data: {
          ...recipe,
          menu_sections: section ? { name: section.name } : null
        }
      };
    }

    return { success: true, data: { ...recipe, menu_sections: null } };
  },

  saveMenuRecipe: async (recipe: any) => {
    const payload = await injectRestaurantId({ ...recipe });
    const { data, error } = await supabase.from('menu_recipes').upsert(payload).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteMenuRecipe: async (recipeId: string) => {
    const rid = getRestaurantId();
    if (!rid) return { success: false, error: 'Restaurant context required' };
    const { data, error } = await supabase
      .from('menu_recipes')
      .delete()
      .eq('restaurant_id', rid)
      .eq('id', recipeId)
      .select('id');
    if (error) return { success: false, error: error.message };
    if (!data || !data.length || data[0].id !== recipeId) {
      return { success: false, error: 'Recipe not found or could not be deleted' };
    }
    return { success: true, data };
  },

  deleteProductionRecipe: async (recipeId: string) => {
    const rid = getRestaurantId();
    if (!rid) return { success: false, error: 'Restaurant context required' };
    const { data, error } = await supabase
      .from('production_recipes')
      .delete()
      .eq('restaurant_id', rid)
      .eq('id', recipeId)
      .select('id');
    if (error) return { success: false, error: error.message };
    if (!data || !data.length || data[0].id !== recipeId) {
      return { success: false, error: 'Recipe not found or could not be deleted' };
    }
    return { success: true, data };
  },

  // --- Phase 2: Recipe Components & BOM Engine ---
  getRecipeComponents: async (recipeId: string) => {
    const { data, error } = await supabase
      .from('recipe_components')
      .select('*, items:item_id(id, name, unit, base_unit, price_usd, department)')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveRecipeComponents: async (recipeId: string, components: any[]) => {
    const { data: currentRows, error: fetchErr } = await supabase
      .from('recipe_components')
      .select('id')
      .eq('recipe_id', recipeId);
    if (fetchErr) return { success: false, error: fetchErr.message };

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const rows = (components || []).map((c, idx) => ({
      id: (c.id && typeof c.id === 'string' && c.id.trim().length > 0 && c.id !== 'null') ? c.id : generateUUID(),
      recipe_id: recipeId,
      item_id: c.item_id,
      base_quantity: Number(c.base_quantity),
      unit: c.unit,
      location_id: c.location_id || null,
      waste_percentage: Number(c.waste_percentage || 0),
      notes: c.notes || null,
      sort_order: idx
    }));

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase.from('recipe_components').upsert(rows);
      if (upsertErr) return { success: false, error: upsertErr.message };
    }

    const keptIds = new Set(rows.map(r => r.id));
    const toRemove = (currentRows || []).map((r: any) => r.id).filter(id => !keptIds.has(id));
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase.from('recipe_components').delete().eq('recipe_id', recipeId).in('id', toRemove);
      if (delErr) return { success: false, error: delErr.message };
    }

    const { data: finalRows } = await supabase
      .from('recipe_components')
      .select('*, items:item_id(id, name, unit, base_unit, price_usd, department)')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true });

    return { success: true, data: finalRows || rows };
  },

  activateMenuRecipe: async (recipeId: string) => {
    const { data: recipe, error: recErr } = await supabase
      .from('menu_recipes')
      .select('product_id')
      .eq('id', recipeId)
      .single();
    if (recErr || !recipe?.product_id) return { success: false, error: 'Recipe is not linked to a POS product.' };

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('inventory_mode')
      .eq('id', recipe.product_id)
      .single();
    if (prodErr || !product || product.inventory_mode !== 'RECIPE') {
      return { success: false, error: 'Product must be in RECIPE inventory mode to activate recipe.' };
    }

    const { data, error } = await supabase.rpc('activate_menu_recipe', {
      p_recipe_id: recipeId
    });
    if (error) return { success: false, error: error.message };
    if (!data || data.success === false) return { success: false, error: data?.error || 'Failed to activate recipe.' };
    return { success: true, ...data };
  },

  getProductsSimpleList: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('products').select('id, name, inventory_mode, price, inventory_applies, concept_id').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getInventoryItemsSimpleList: async () => {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, unit, base_unit, price_usd, department, default_inventory_location_id, vat')
      .order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getInventoryLocationsSimpleList: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_locations').select('id, name, department').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getAllProductCustomizations: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('product_customizations').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getAllModifierInventoryEffects: async () => {
    const { data, error } = await supabase
      .from('modifier_inventory_effects')
      .select('*, items:item_id(id, name, unit, base_unit, price_usd, department)');
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getProductCustomizationsList: async (productId: number) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('product_customizations')
      .select('*')
      .eq('product_id', productId);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  validateRecipeComponentUnits: async (components: any[], items: any[] = []) => {
    try {
      const { data, error } = await supabase.rpc('validate_recipe_component_units', {
        p_components: components
      });
      if (error) {
        console.warn('validate_recipe_component_units RPC notice:', error.message);
        // Fall back gracefully if RPC schema is unavailable
        return { success: true };
      }
      if (data && data.success === false) {
        return { success: false, error: data.error || 'Invalid component unit conversion.' };
      }
      return { success: true, data };
    } catch (e: any) {
      console.warn('validateRecipeComponentUnits exception fallback:', e.message);
      return { success: true };
    }
  },

  saveProductInventoryMode: async (productId: number, mode: string, previousMode?: string) => {
    const patch: any = { inventory_mode: mode };
    if (mode === 'NONE') patch.inventory_applies = false;
    let query = supabase.from('products').update(patch).eq('id', productId);
    if (previousMode) query = query.eq('inventory_mode', previousMode);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getProductInventoryItemMapping: async (productId: number) => {
    const rid = getRestaurantId();
    let query = supabase.from('product_inventory_item_mappings').select('*').eq('product_id', productId);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getAllProductInventoryItemMappings: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('product_inventory_item_mappings').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveProductInventoryItemMapping: async (productId: number, itemId: string, ratio: number) => {
    if (!Number.isFinite(Number(ratio)) || Number(ratio) <= 0) {
      return { success: false, error: 'Conversion ratio must be a finite positive number.' };
    }
    const rid = getRestaurantId();

    // Look up any existing mapping for this product to preserve the primary key id
    let query = supabase.from('product_inventory_item_mappings').select('id').eq('product_id', productId);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data: existing } = await query.maybeSingle();

    const payload: any = {
      restaurant_id: rid,
      product_id: productId,
      item_id: itemId,
      conversion_ratio: Number(ratio),
      updated_at: new Date().toISOString()
    };
    if (existing?.id) {
      payload.id = existing.id;
    }

    const { data, error } = await supabase
      .from('product_inventory_item_mappings')
      .upsert(payload, { onConflict: 'restaurant_id,product_id' });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getInventoryUnitConversions: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('item_unit_conversions').select('*');
    if (rid) query = query.or(`restaurant_id.eq.${rid},restaurant_id.is.null`);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveItemUnitConversion: async (payload: any) => {
    const rid = payload.restaurant_id || getRestaurantId();
    const dataToSave = {
      ...payload,
      restaurant_id: rid,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('item_unit_conversions').upsert(dataToSave);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteItemUnitConversion: async (id: string) => {
    const { error } = await supabase.from('item_unit_conversions').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getModifierInventoryEffectsList: async (productCustomizationId: number) => {
    const { data, error } = await supabase
      .from('modifier_inventory_effects')
      .select('*, items:item_id(name, unit, base_unit)')
      .eq('product_customization_id', productCustomizationId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getAllProductModifierEffects: async (productCustomizationIds: number[]) => {
    if (!productCustomizationIds || productCustomizationIds.length === 0) return { success: true, data: [] };
    const { data, error } = await supabase
      .from('modifier_inventory_effects')
      .select('*, items:item_id(id, name, unit, base_unit, price_usd, vat)')
      .in('product_customization_id', productCustomizationIds);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveModifierInventoryEffect: async (effect: any) => {
    const { data, error } = await supabase
      .from('modifier_inventory_effects')
      .upsert(effect)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteModifierInventoryEffect: async (id: string) => {
    const { error } = await supabase
      .from('modifier_inventory_effects')
      .delete()
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  applyModifierEffectsToAllMatchingProducts: async (sourceCustomizationId: number) => {
    const rid = getRestaurantId();
    // 1. Get the source customization
    const { data: sourceCustomization, error: sourceErr } = await supabase
      .from('product_customizations')
      .select('*')
      .eq('id', sourceCustomizationId)
      .single();
    if (sourceErr || !sourceCustomization) {
      return { success: false, error: sourceErr?.message || 'Source modifier not found.' };
    }

    // 2. Get the existing effects on this customization
    const { data: sourceEffects, error: effErr } = await supabase
      .from('modifier_inventory_effects')
      .select('*')
      .eq('product_customization_id', sourceCustomizationId);
    if (effErr) return { success: false, error: effErr.message };

    // 3. Find matching product_customizations on other products
    let query = supabase
      .from('product_customizations')
      .select('id, product_id, ingredient, customization_item_id')
      .neq('id', sourceCustomizationId);

    if (rid) query = query.eq('restaurant_id', rid);

    if (sourceCustomization.customization_item_id) {
      query = query.or(`customization_item_id.eq.${sourceCustomization.customization_item_id},ingredient.ilike.${sourceCustomization.ingredient.trim()}`);
    } else if (sourceCustomization.ingredient) {
      query = query.ilike('ingredient', sourceCustomization.ingredient.trim());
    }

    const { data: targets, error: targetErr } = await query;
    if (targetErr) return { success: false, error: targetErr.message };
    if (!targets || targets.length === 0) {
      return { success: true, updatedProductsCount: 0 };
    }

    const targetIds = targets.map((t: any) => t.id);

    // 4. Delete existing effects on matching customizations
    if (targetIds.length > 0) {
      await supabase
        .from('modifier_inventory_effects')
        .delete()
        .in('product_customization_id', targetIds);
    }

    // 5. If source has effects, copy them over to all targets
    if (sourceEffects && sourceEffects.length > 0) {
      const newEffects: any[] = [];
      for (const target of targets) {
        for (const eff of sourceEffects) {
          newEffects.push({
            product_customization_id: target.id,
            customization_item_id: target.customization_item_id || eff.customization_item_id || null,
            item_id: eff.item_id,
            effect_type: eff.effect_type,
            quantity_delta: eff.quantity_delta,
            unit: eff.unit,
            location_id: eff.location_id || null,
            notes: eff.notes || null
          });
        }
      }
      if (newEffects.length > 0) {
        const { error: insErr } = await supabase
          .from('modifier_inventory_effects')
          .insert(newEffects);
        if (insErr) return { success: false, error: insErr.message };
      }
    }

    const uniqueProductCount = new Set(targets.map((t: any) => t.product_id)).size;
    return { success: true, updatedProductsCount: uniqueProductCount };
  },

  copyProductModifiersAndEffects: async (fromProductId: number, toProductId: number) => {
    const rid = getRestaurantId();
    // 1. Get source product customizations
    let q = supabase.from('product_customizations').select('*').eq('product_id', fromProductId);
    if (rid) q = q.eq('restaurant_id', rid);
    const { data: sourceMods, error: modErr } = await q;
    if (modErr) return { success: false, error: modErr.message };
    if (!sourceMods || sourceMods.length === 0) {
      return { success: false, error: 'Source product has no modifiers to copy.' };
    }

    // 2. Get all effects for source customizations
    const sourceModIds = sourceMods.map((m: any) => m.id);
    const { data: sourceEffects } = await supabase
      .from('modifier_inventory_effects')
      .select('*')
      .in('product_customization_id', sourceModIds);

    // 3. For target product, check existing customizations or copy over
    let targetQ = supabase.from('product_customizations').select('*').eq('product_id', toProductId);
    if (rid) targetQ = targetQ.eq('restaurant_id', rid);
    const { data: targetMods } = await targetQ;
    const targetMap = new Map((targetMods || []).map((m: any) => [m.ingredient?.toLowerCase()?.trim(), m]));

    for (const sMod of sourceMods) {
      const key = sMod.ingredient?.toLowerCase()?.trim();
      let targetModId = targetMap.get(key)?.id;

      if (!targetModId) {
        // Create new customization for target product
        const { data: newMod, error: newModErr } = await supabase
          .from('product_customizations')
          .insert({
            product_id: toProductId,
            ingredient: sMod.ingredient,
            customization_type: sMod.customization_type,
            price: sMod.price,
            is_active: sMod.is_active,
            customization_item_id: sMod.customization_item_id,
            is_required: sMod.is_required,
            is_multi_select: sMod.is_multi_select,
            option_group_name: sMod.option_group_name,
            restaurant_id: rid || sMod.restaurant_id
          })
          .select('id')
          .single();
        if (!newModErr && newMod) {
          targetModId = newMod.id;
        }
      }

      if (targetModId) {
        // Copy matching effects
        const matchingEffects = (sourceEffects || []).filter((e: any) => e.product_customization_id === sMod.id);
        if (matchingEffects.length > 0) {
          // Remove old effects on target mod first
          await supabase.from('modifier_inventory_effects').delete().eq('product_customization_id', targetModId);
          const effectsToInsert = matchingEffects.map((e: any) => ({
            product_customization_id: targetModId,
            customization_item_id: e.customization_item_id || null,
            item_id: e.item_id,
            effect_type: e.effect_type,
            quantity_delta: e.quantity_delta,
            unit: e.unit,
            location_id: e.location_id || null,
            notes: e.notes || null
          }));
          await supabase.from('modifier_inventory_effects').insert(effectsToInsert);
        }
      }
    }

    return { success: true };
  },

  // Branches, Departments and Users for Access Control Dropdowns
  getBranchesList: async (includeInactive = false) => {
    const rid = getRestaurantId();
    let query = supabase.from('branches').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    const filtered = (data || []).filter((b: any) => {
      if (includeInactive) return true;
      const status = (b.status || '').toString().trim().toLowerCase();
      if (status === 'inactive' || status === 'disabled' || status === 'archived' || status === 'deleted') return false;
      if (b.is_active === false || b.is_active === 0 || b.is_active === 'false') return false;
      return true;
    });
    return { success: true, data: filtered };
  },

  getDepartmentsList: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('departments').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getAllUsers: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('users').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    if (Array.isArray(data)) {
      try {
        const stored = JSON.parse(localStorage.getItem('flow_user_concept_settings') || '{}');
        const restId = rid || getRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
        const { data: restData } = await supabase.from('restaurants').select('settings').eq('id', restId).maybeSingle();
        const remoteUserConcepts = restData?.settings?.user_concepts || {};

        data.forEach(u => {
          const cfg = remoteUserConcepts[u.id] || stored[u.id];
          if (cfg) {
            u.concept = u.concept || cfg.concept || 'ALL';
            u.can_switch_concepts = u.can_switch_concepts !== undefined ? u.can_switch_concepts : cfg.can_switch_concepts;
          }
        });
      } catch (e) {}
    }

    return { success: true, data };
  },

  // HR & Employees
  getEmployees: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('employees').select('*').order('first_name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getEmployeeById: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('employees').select('*').eq('employee_id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveEmployee: async (employee: any) => {
    const payload = await injectRestaurantId({ ...employee });
    let res;
    if (payload.employee_id) {
      res = await supabase.from('employees').update(payload).eq('employee_id', payload.employee_id);
    } else {
      res = await supabase.from('employees').insert(payload);
    }
    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  },

  updateEmployeeCriteria: async (employeeId: string, criteria: { is_payroll_eligible?: boolean; track_attendance?: boolean; shift_management?: boolean; is_tips_eligible?: boolean }) => {
    const res = await supabase.from('employees').update({
      ...criteria,
      updated_at: new Date().toISOString()
    }).eq('employee_id', employeeId);
    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  },

  // Staff Departments & Sections (Employees & HR)
  getStaffDepartments: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('staff_departments').select('*').order('display_order', { ascending: true }).order('name', { ascending: true });
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveStaffDepartment: async (dept: { id?: string; name: string; color?: string; display_order?: number }) => {
    const payload = await injectRestaurantId({ ...dept });
    if (!payload.restaurant_id) {
      return { success: false, error: 'Restaurant ID is required' };
    }

    if (payload.id) {
      const { data: oldDept } = await supabase
        .from('staff_departments')
        .select('name')
        .eq('id', payload.id)
        .maybeSingle();

      const { id, ...updateData } = payload;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('staff_departments')
        .update(updateData)
        .eq('id', id)
        .eq('restaurant_id', payload.restaurant_id)
        .select();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: `A department named "${payload.name}" already exists.` };
        }
        return { success: false, error: error.message };
      }

      if (oldDept && oldDept.name !== payload.name) {
        await supabase
          .from('staff_sections')
          .update({ department_name: payload.name })
          .eq('department_id', id)
          .eq('restaurant_id', payload.restaurant_id);

        await supabase
          .from('employees')
          .update({ department: payload.name })
          .eq('department', oldDept.name)
          .eq('restaurant_id', payload.restaurant_id);
      }

      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } else {
      const { data, error } = await supabase
        .from('staff_departments')
        .insert(payload)
        .select();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: `A department named "${payload.name}" already exists.` };
        }
        return { success: false, error: error.message };
      }
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    }
  },

  deleteStaffDepartment: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('staff_departments').delete().eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getStaffSections: async (departmentName?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('staff_sections').select('*').order('display_order', { ascending: true }).order('name', { ascending: true });
    if (rid) query = query.eq('restaurant_id', rid);
    if (departmentName) query = query.eq('department_name', departmentName);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveStaffSection: async (section: { id?: string; department_id?: string; department_name: string; name: string; display_order?: number }) => {
    const payload = await injectRestaurantId({ ...section });
    if (!payload.restaurant_id) {
      return { success: false, error: 'Restaurant ID is required' };
    }

    if (payload.id) {
      const { data: oldSec } = await supabase
        .from('staff_sections')
        .select('department_name, name')
        .eq('id', payload.id)
        .maybeSingle();

      const { id, ...updateData } = payload;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('staff_sections')
        .update(updateData)
        .eq('id', id)
        .eq('restaurant_id', payload.restaurant_id)
        .select();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: `A section named "${payload.name}" already exists in "${payload.department_name}".` };
        }
        return { success: false, error: error.message };
      }

      if (oldSec && (oldSec.name !== payload.name || oldSec.department_name !== payload.department_name)) {
        await supabase
          .from('employees')
          .update({
            department: payload.department_name,
            sub_department: payload.name
          })
          .eq('department', oldSec.department_name)
          .eq('sub_department', oldSec.name)
          .eq('restaurant_id', payload.restaurant_id);
      }

      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } else {
      const { data, error } = await supabase
        .from('staff_sections')
        .insert(payload)
        .select();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: `A section named "${payload.name}" already exists in "${payload.department_name}".` };
        }
        return { success: false, error: error.message };
      }
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    }
  },

  deleteStaffSection: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('staff_sections').delete().eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getUserById: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('users').select('*').eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.single();
    if (error) return { success: false, error: error.message };

    if (data) {
      try {
        const stored = JSON.parse(localStorage.getItem('flow_user_concept_settings') || '{}');
        if (stored[id]) {
          data.concept = data.concept || stored[id].concept || 'ALL';
          data.can_switch_concepts = data.can_switch_concepts !== undefined ? data.can_switch_concepts : stored[id].can_switch_concepts;
        }
      } catch (e) {}
    }

    return { success: true, data };
  },

  saveUser: async (user: any) => {
    const payload = await injectRestaurantId({ ...user });
    const { concept, can_switch_concepts, ...cleanPayload } = payload;
    let res: any;

    if (payload.id) {
      res = await supabase.from('users').update(payload).eq('id', payload.id).select();
    } else {
      res = await supabase.from('users').insert(payload).select();
    }

    // Check if error is due to missing multi-concept columns in unmigrated production schema
    if (res?.error && (
      res.error.message?.includes('can_switch_concepts') || 
      res.error.message?.includes('concept') || 
      res.error.code === 'PGRST204'
    )) {
      if (cleanPayload.id) {
        res = await supabase.from('users').update(cleanPayload).eq('id', cleanPayload.id).select();
        if (!res.error && (!res.data || res.data.length === 0)) {
          res = await supabase.from('users').insert(cleanPayload).select();
        }
      } else {
        res = await supabase.from('users').insert(cleanPayload).select();
      }
    }

    if (res?.error) return { success: false, error: res.error.message };

    const savedUser = res?.data && res.data.length > 0 ? res.data[0] : null;
    const targetId = savedUser?.id || payload.id;

    // Persist concept assignment in local storage fallback
    if (targetId && (concept !== undefined || can_switch_concepts !== undefined)) {
      try {
        const stored = JSON.parse(localStorage.getItem('flow_user_concept_settings') || '{}');
        stored[targetId] = {
          concept: concept || 'ALL',
          can_switch_concepts: can_switch_concepts !== undefined ? can_switch_concepts : true,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('flow_user_concept_settings', JSON.stringify(stored));
      } catch (e) {}

      // Persist to shared Supabase restaurant settings for real-time POS authorization
      try {
        const restId = payload.restaurant_id || getRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
        const { data: restData } = await supabase.from('restaurants').select('settings').eq('id', restId).maybeSingle();
        if (restData) {
          const currentSettings = restData.settings || {};
          const userConcepts = { ...(currentSettings.user_concepts || {}) };
          userConcepts[targetId] = {
            concept: concept || 'ALL',
            can_switch_concepts: can_switch_concepts !== undefined ? can_switch_concepts : true,
            updated_at: new Date().toISOString()
          };
          await supabase.from('restaurants').update({ settings: { ...currentSettings, user_concepts: userConcepts } }).eq('id', restId);
        }
      } catch (e) {
        console.warn('Failed to sync user concept to restaurant settings:', e);
      }
    }

    return { 
      success: true, 
      data: savedUser ? { ...savedUser, concept: concept || 'ALL', can_switch_concepts } : null 
    };
  },

  deleteUser: async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  hardDeleteEmployee: async (employeeId: string, appUserId?: string | null, userName?: string | null) => {
    try {
      // HR related data by employee_id
      const hrTables = [
        'employee_attendance',
        'employee_attendance_breaks',
        'employee_missing_punches',
        'employee_leave_requests',
        'employee_shift_requests',
        'employee_schedules',
        'employee_payroll_items',
        'payrolls',
        'loans',
        'tp_assessments',
        'tp_employee_training',
        'employee_training_progress',
        'tips_distribution'
      ];
      
      for (const table of hrTables) {
        if (table === 'employee_leave_requests') {
          await supabase.from(table).delete().eq('employee_id', employeeId);
          await supabase.from(table).delete().eq('peer_employee_id', employeeId);
        } else if (table === 'employee_shift_requests') {
          await supabase.from(table).delete().eq('employee_id', employeeId);
          await supabase.from(table).delete().eq('target_employee_id', employeeId);
        } else {
          await supabase.from(table).delete().eq('employee_id', employeeId);
        }
      }

      // User name related (logs, push tokens)
      if (userName) {
        await supabase.from('activity_logs').delete().eq('user_name', userName);
        await supabase.from('user_push_tokens').delete().eq('user_name', userName);
      }

      // App User ID related
      if (appUserId) {
        await supabase.from('users').delete().eq('id', appUserId);
      }

      // Finally delete employee
      const { error } = await supabase.from('employees').delete().eq('employee_id', employeeId);
      if (error) return { success: false, error: error.message };

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },


  uploadHrDocument: async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `employees/${fileName}`;

      const { data, error } = await supabase.storage.from('hr_docs').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (error) return { success: false, error: error.message };

      // Return the file path, NOT a public URL, because bucket is private
      return { success: true, path: data.path };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getHrSignedUrl: async (path: string) => {
    // Check if it's already a full URL (legacy or mistakenly public data)
    if (path.startsWith('http')) return { success: true, url: path };
    
    // URL valid for 1 hour (3600 seconds)
    const { data, error } = await supabase.storage.from('hr_docs').createSignedUrl(path, 3600);
    if (error) return { success: false, error: error.message };
    return { success: true, url: data.signedUrl };
  },

  // --------------------------------------------------------------------------
  // TIPS BOX API
  // --------------------------------------------------------------------------

  getTipsSettings: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('tips_settings').select('*');
    if (branch) query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveTipsSettings: async (settings: any) => {
    const payload = await injectRestaurantId({ ...settings });
    const { error } = await supabase.from('tips_settings').upsert(payload, { onConflict: 'branch' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getEmployeesForTips: async (branch: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('employees').select('*').eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    const eligible = (data || []).filter((e: any) => {
      const status = (e.status || '').toString().trim().toLowerCase();
      if (status === 'inactive' || status === 'disabled' || status === 'archived' || status === 'terminated') return false;
      if (e.is_active === false || e.is_active === 0 || e.is_active === 'false') return false;
      if (e.active === false || e.active === 0 || e.active === 'false') return false;
      if (e.is_tips_eligible === false) return false;
      return true;
    });
    return { success: true, data: eligible };
  },

  createTipsCollection: async (collection: any, distribution: any[]) => {
    // 1. Insert collection
    const payload = await injectRestaurantId({ ...collection });
    const { data: colData, error: colError } = await supabase.from('tips_collections').insert(payload).select().single();
    if (colError) return { success: false, error: colError.message };

    // 2. Insert distribution with the new collection ID
    const rid = colData.restaurant_id || getRestaurantId();
    const distData = distribution.map(d => {
      const { points, dept_allocated_pool, ...cleanD } = d;
      return {
        ...cleanD,
        department: d.department || 'Floor',
        sub_department: d.sub_department || null,
        tips_collection_id: colData.id,
        ...(rid ? { restaurant_id: rid } : {})
      };
    });
    const { error: distError } = await supabase.from('tips_distribution').insert(distData);
    if (distError) {
      // rollback collection if distribution fails
      await supabase.from('tips_collections').delete().eq('id', colData.id);
      return { success: false, error: distError.message };
    }

    return { success: true, data: colData };
  },

  updateTipsCollectionAndDistribution: async (collectionId: string, collectionUpdates: any, distribution: any[]) => {
    const payload = await injectRestaurantId({ ...collectionUpdates });
    const { error: colError } = await supabase.from('tips_collections').update(payload).eq('id', collectionId);
    if (colError) return { success: false, error: colError.message };

    // Delete old distribution and insert new
    await supabase.from('tips_distribution').delete().eq('tips_collection_id', collectionId);
    
    const rid = payload.restaurant_id || getRestaurantId();
    const distData = distribution.map(d => {
      const { points, dept_allocated_pool, id: _dId, created_at: _cAt, ...cleanD } = d;
      return {
        ...cleanD,
        department: d.department || 'Floor',
        sub_department: d.sub_department || null,
        tips_collection_id: collectionId,
        ...(rid ? { restaurant_id: rid } : {})
      };
    });
    const { error: distError } = await supabase.from('tips_distribution').insert(distData);
    if (distError) return { success: false, error: distError.message };

    return { success: true };
  },

  getTipsCollections: async (branch?: string, status?: string, department?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('tips_collections').select('*').order('created_at', { ascending: false });
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (status && status !== 'All') query = query.eq('status', status);
    if (department && department !== 'All') query = query.eq('department', department);
    if (rid) query = query.eq('restaurant_id', rid);
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getTipsDistribution: async (collectionId: string) => {
    const { data, error } = await supabase.from('tips_distribution').select('*').eq('tips_collection_id', collectionId);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Auth & Security (App Permissions)
  getAllAppPermissions: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('app_permissions').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    // Surface can_access_pos from admin_permissions JSONB to top-level
    const normalized = (data || []).map((row: any) => ({
      ...row,
      can_access_pos: row.admin_permissions?.can_access_pos ?? row.can_access_pos ?? false
    }));
    return { success: true, data: normalized };
  },

  saveAppPermission: async (payload: any) => {
    const cleanPayload = { ...payload };
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!cleanPayload.restaurant_id || !uuidRegex.test(cleanPayload.restaurant_id)) {
      const rid = getRestaurantId();
      if (rid && uuidRegex.test(rid)) {
        cleanPayload.restaurant_id = rid;
      } else {
        delete cleanPayload.restaurant_id;
      }
    }

    // can_access_pos is stored inside admin_permissions JSONB (no top-level column needed)
    if ('can_access_pos' in cleanPayload) {
      const posVal = cleanPayload.can_access_pos;
      delete cleanPayload.can_access_pos;
      cleanPayload.admin_permissions = {
        ...(cleanPayload.admin_permissions || {}),
        can_access_pos: posVal
      };
    }

    const { error } = await supabase.from('app_permissions').upsert(cleanPayload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getAdminUsers: async () => {
    const rid = getRestaurantId();
    let query = supabase
      .from('users')
      .select('id, name, role, email, branch, departments, restaurant_id, admin_permissions')
      .in('role', ['Admin', 'Manager', 'SuperAdmin', 'admin', 'manager', 'superadmin'])
      .order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveAdminUserPermissions: async (
    userId: string,
    adminPermissions: Record<string, boolean>,
    userName?: string,
    userRole?: string,
    standardPerms?: any
  ) => {
    try {
      const rid = getRestaurantId();

      // 1. Update users.admin_permissions
      const { error: userError } = await supabase
        .from('users')
        .update({ admin_permissions: adminPermissions })
        .eq('id', userId);

      if (userError) {
        console.warn('Notice: updating users.admin_permissions:', userError.message);
      }

      // 2. Upsert into app_permissions
      const payload: any = {
        id: `admin_user:${userId}`,
        type: 'admin_user',
        name: userName || userId,
        admin_permissions: adminPermissions,
        ...(standardPerms || {})
      };
      if (rid) payload.restaurant_id = rid;

      // Sync module keys to boolean columns if applicable
      if (adminPermissions.orders !== undefined) {
        payload.can_create_orders = adminPermissions.orders;
        payload.can_receive_orders = adminPermissions.orders;
      }
      if (adminPermissions.purchasing !== undefined) {
        payload.can_create_purchasing = adminPermissions.purchasing;
        payload.can_receive_purchasing = adminPermissions.purchasing;
      }
      if (adminPermissions.catalog !== undefined) {
        payload.can_view_catalog = adminPermissions.catalog;
        payload.can_manage_catalog = adminPermissions.catalog;
      }
      if (adminPermissions.finance !== undefined) {
        payload.can_view_finance_dashboard = adminPermissions.finance;
      }
      if (adminPermissions.employees !== undefined || adminPermissions.salary_payments !== undefined) {
        payload.can_manage_hr = !!(adminPermissions.employees || adminPermissions.salary_payments);
      }
      if (adminPermissions.attendance !== undefined) {
        payload.can_manage_attendance = adminPermissions.attendance;
        payload.can_view_attendance_reports = adminPermissions.attendance;
      }
      if (adminPermissions.permissions !== undefined) {
        payload.can_access_settings = adminPermissions.permissions;
      }

      const res = await api.saveAppPermission(payload);
      return res;
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to save admin user permissions' };
    }
  },

  setUserPortalCredentials: async (userId: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_set_user_credentials', {
        p_user_id: userId,
        p_email: email.trim().toLowerCase(),
        p_password: password
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to update portal credentials' };
    }
  },

  // --------------------------------------------------------------------------
  // SOPs & Training API
  // --------------------------------------------------------------------------
  getTrainingCategories: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('training_categories').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  addTrainingCategory: async (name: string, description?: string, allowed_roles?: string[], icon?: string) => {
    const { error } = await supabase.from('training_categories').insert({ 
      name, 
      description,
      allowed_roles: allowed_roles || ['Admin', 'Manager', 'Staff'],
      ...(icon ? { icon } : {})
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteTrainingCategory: async (id: string) => {
    const { error } = await supabase.from('training_categories').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getSubcategories: async (department?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('training_subcategories').select('*').order('name');
    if (department) query = query.eq('department', department);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  addSubcategory: async (name: string, department: string, allowed_roles?: string[]) => {
    const { error } = await supabase.from('training_subcategories').insert({ 
      name, 
      department,
      allowed_roles: allowed_roles || ['Admin', 'Manager', 'Staff']
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteSubcategory: async (id: string) => {
    const { error } = await supabase.from('training_subcategories').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getTrainingDocuments: async (categoryId?: string, department?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('training_documents').select('*').order('created_at', { ascending: false });
    if (categoryId) query = query.eq('category_id', categoryId);
    if (department && department !== 'All') query = query.eq('department', department);
    if (rid) query = query.eq('restaurant_id', rid);
    
    const { data: docs, error: docsError } = await query;
    if (docsError) return { success: false, error: docsError.message };

    let catsQuery = supabase.from('training_categories').select('*');
    if (rid) catsQuery = catsQuery.eq('restaurant_id', rid);
    const { data: cats, error: catsError } = await catsQuery;
    if (catsError) return { success: false, error: catsError.message };

    const catsMap = new Map();
    cats?.forEach(cat => {
      catsMap.set(String(cat.id), cat);
    });

    const joinedDocs = docs?.map(doc => ({
      ...doc,
      training_categories: doc.category_id && catsMap.has(String(doc.category_id))
        ? catsMap.get(String(doc.category_id))
        : null
    }));

    return { success: true, data: joinedDocs };
  },

  saveTrainingDocument: async (doc: any) => {
    try {
      let error;
      if (doc.id) {
        const res = await supabase.from('training_documents').update(doc).eq('id', doc.id);
        error = res.error;
      } else {
        const res = await supabase.from('training_documents').insert(doc);
        error = res.error;
      }
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  uploadTrainingMedia: async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;
      
      const { error } = await supabase.storage.from('training_media').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (error) return { success: false, error: error.message };
      
      const { data: urlData } = supabase.storage.from('training_media').getPublicUrl(filePath);
      return { success: true, url: urlData.publicUrl };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // --------------------------------------------------------------------------
  // APP PERMISSIONS (per-user)
  // --------------------------------------------------------------------------
  getAppPermissions: async (userName: string, departments: string, userRole: string, userId?: string) => {
    const DEFAULT_PERMISSIONS = {
      can_create_orders: false,
      can_send_orders: false,
      can_receive_orders: false,
      can_edit_all_orders: false,
      can_add_items_to_orders: false,
      can_order_all_departments: false,
      can_create_purchasing: false,
      can_order_purchasing: false,
      can_receive_purchasing: false,
      can_view_menu_manual: false,
      can_manage_menu_manual: false,
      can_manage_tips: false,
      can_manage_checklists: false,
      can_fill_checklists: false,
      can_log_waste: false,
      can_view_waste_report: false,
      can_manage_hr: false,
      can_manage_training: false,
      can_manage_reservations: false,
      can_access_settings: false,
      can_view_schedule: true,
      can_manage_schedules: false,
      can_view_timesheet: true,
      can_view_salary: true,
      can_request_leave: true,
      can_approve_leave: false,
      can_request_shift_swap: true,
      can_approve_shift_swap: false,
      can_submit_missing_punch: true,
      can_approve_missing_punch: false,
      can_view_attendance_reports: false,
      can_manage_branches: false,
      can_manage_wallets: false,
      can_manage_news: false,
      can_manage_daily_cash: false,
      can_view_86: false,
      can_manage_86: false,
      can_view_complaints: false,
      can_manage_complaints: false,
      can_view_upsell: false,
      can_manage_upsell: false,
      can_manage_tasks: false,
      can_view_voids: false,
      can_manage_voids: false,
      can_punch_clock: false,
      can_view_finance_dashboard: false,
      can_view_signin_logs: false,
      can_view_client_orders: false,
      can_manage_client_orders: false,
      can_view_client_reports: false,
      can_manage_attendance: false,
      can_view_catalog: false,
      can_manage_catalog: false,
      can_view_suppliers: false,
      can_manage_suppliers: false,
      can_view_price_intelligence: false,
      can_manage_price_intelligence: false,
      can_view_inventory: false,
      can_manage_inventory: false,
      allowed_departments: ''
    };

    const roleLower = (userRole || '').toLowerCase().trim();

    // 0. SuperAdmin has unrestricted root access to everything
    if (roleLower === 'superadmin') {
      const adminPerms = Object.keys(DEFAULT_PERMISSIONS).reduce((acc: any, key) => {
        acc[key] = key !== 'allowed_departments' ? true : '';
        return acc;
      }, {});
      adminPerms.admin_permissions = {
        orders: true, client_orders: true, reservations: true, checklists: true, tasks: true,
        catalog: true, purchasing: true, suppliers: true, price_intelligence: true, waste: true,
        missing_items: true, inventory_reporting: true, voids: true, employees: true,
        departments_sections: true, salary_payments: true, assessments: true, attendance: true,
        tips: true, permissions: true, signin_logs: true, complaints: true, specials: true,
        finance: true, payment_details: true, reel_credit: true, branch_management: true,
        wallets: true, news: true, sops: true, menu: true
      };
      return { success: true, data: adminPerms };
    }

    // 1. Admin or Manager role permission resolution
    if (roleLower === 'admin' || roleLower === 'manager' || roleLower.includes('admin')) {
      let customAdminPerms: Record<string, boolean> | null = null;
      let userRowData: any = null;

      // Try fetching user record from users table
      if (userId) {
        const { data: u } = await supabase.from('users').select('admin_permissions').eq('id', userId).single();
        if (u?.admin_permissions && Object.keys(u.admin_permissions).length > 0) {
          customAdminPerms = u.admin_permissions;
        }
        if (!customAdminPerms) {
          const { data: ap } = await supabase.from('app_permissions').select('*').eq('id', `admin_user:${userId}`).single();
          if (ap?.admin_permissions && Object.keys(ap.admin_permissions).length > 0) {
            customAdminPerms = ap.admin_permissions;
            userRowData = ap;
          }
        }
      }

      if (!customAdminPerms && userName) {
        const { data: uByName } = await supabase.from('users').select('admin_permissions').eq('name', userName).single();
        if (uByName?.admin_permissions && Object.keys(uByName.admin_permissions).length > 0) {
          customAdminPerms = uByName.admin_permissions;
        }
        if (!customAdminPerms) {
          const { data: apByName } = await supabase.from('app_permissions').select('*').eq('id', `user:${userName}`).single();
          if (apByName?.admin_permissions && Object.keys(apByName.admin_permissions).length > 0) {
            customAdminPerms = apByName.admin_permissions;
            userRowData = apByName;
          }
        }
      }

      const defaultAdminPerms: Record<string, boolean> = {
        orders: true, client_orders: true, reservations: true, checklists: true, tasks: true,
        catalog: true, purchasing: true, suppliers: true, price_intelligence: true, waste: true,
        missing_items: true, inventory_reporting: true, voids: true, employees: true,
        departments_sections: true, salary_payments: true, assessments: true, attendance: true,
        tips: true, permissions: true, signin_logs: true, complaints: true, specials: true,
        finance: true, payment_details: true, reel_credit: true, branch_management: true,
        wallets: true, news: true, sops: true, menu: true
      };

      const defaultManagerPerms: Record<string, boolean> = {
        orders: true, client_orders: true, reservations: true, checklists: true, tasks: true,
        catalog: true, purchasing: true, suppliers: true, price_intelligence: false, waste: true,
        missing_items: true, inventory_reporting: true, voids: false, employees: false,
        departments_sections: false, salary_payments: false, assessments: true, attendance: true,
        tips: true, permissions: false, signin_logs: false, complaints: true, specials: true,
        finance: false, payment_details: false, reel_credit: false, branch_management: false,
        wallets: false, news: true, sops: true, menu: true
      };

      const roleDefaults = roleLower === 'admin' ? defaultAdminPerms : defaultManagerPerms;
      const resolvedAdminPerms = customAdminPerms ? { ...roleDefaults, ...customAdminPerms } : roleDefaults;

      const basePerms: any = Object.keys(DEFAULT_PERMISSIONS).reduce((acc: any, key) => {
        acc[key] = roleLower === 'admin' ? (key !== 'allowed_departments') : false;
        return acc;
      }, {});

      // Synchronize module keys to standard capability flags
      basePerms.can_create_orders = resolvedAdminPerms.orders !== false;
      basePerms.can_receive_orders = resolvedAdminPerms.orders !== false;
      basePerms.can_view_catalog = resolvedAdminPerms.catalog !== false;
      basePerms.can_manage_catalog = resolvedAdminPerms.catalog !== false;
      basePerms.can_view_suppliers = resolvedAdminPerms.suppliers !== false;
      basePerms.can_manage_suppliers = resolvedAdminPerms.suppliers !== false;
      basePerms.can_view_price_intelligence = resolvedAdminPerms.price_intelligence !== false;
      basePerms.can_create_purchasing = resolvedAdminPerms.purchasing !== false;
      basePerms.can_receive_purchasing = resolvedAdminPerms.purchasing !== false;
      basePerms.can_view_waste_report = resolvedAdminPerms.waste !== false;
      basePerms.can_log_waste = resolvedAdminPerms.waste !== false;
      basePerms.can_view_86 = resolvedAdminPerms.missing_items !== false;
      basePerms.can_manage_86 = resolvedAdminPerms.missing_items !== false;
      basePerms.can_view_inventory = resolvedAdminPerms.inventory_reporting !== false;
      basePerms.can_manage_inventory = resolvedAdminPerms.inventory_reporting !== false;
      basePerms.can_view_voids = resolvedAdminPerms.voids !== false;
      basePerms.can_manage_hr = resolvedAdminPerms.employees !== false || resolvedAdminPerms.salary_payments !== false;
      basePerms.can_manage_attendance = resolvedAdminPerms.attendance !== false;
      basePerms.can_view_attendance_reports = resolvedAdminPerms.attendance !== false;
      basePerms.can_manage_tips = resolvedAdminPerms.tips !== false;
      basePerms.can_access_settings = resolvedAdminPerms.permissions !== false;
      basePerms.can_view_complaints = resolvedAdminPerms.complaints !== false;
      basePerms.can_manage_complaints = resolvedAdminPerms.complaints !== false;
      basePerms.can_view_upsell = resolvedAdminPerms.specials !== false;
      basePerms.can_view_finance_dashboard = resolvedAdminPerms.finance !== false;
      basePerms.can_manage_branches = resolvedAdminPerms.branch_management !== false;
      basePerms.can_manage_wallets = resolvedAdminPerms.wallets !== false;
      basePerms.can_manage_news = resolvedAdminPerms.news !== false;
      basePerms.can_manage_training = resolvedAdminPerms.sops !== false;
      basePerms.can_view_menu_manual = resolvedAdminPerms.menu !== false;
      basePerms.can_manage_menu_manual = resolvedAdminPerms.menu !== false;
      basePerms.can_view_signin_logs = resolvedAdminPerms.signin_logs !== false;
      basePerms.can_manage_tasks = resolvedAdminPerms.tasks !== false;
      basePerms.can_manage_reservations = resolvedAdminPerms.reservations !== false;
      basePerms.can_manage_checklists = resolvedAdminPerms.checklists !== false;
      basePerms.can_view_client_orders = resolvedAdminPerms.client_orders !== false;
      basePerms.can_manage_client_orders = resolvedAdminPerms.client_orders !== false;
      basePerms.can_manage_assessments = resolvedAdminPerms.assessments !== false;

      if (userRowData) {
        Object.assign(basePerms, userRowData);
      }

      basePerms.admin_permissions = resolvedAdminPerms;
      return { success: true, data: basePerms };
    }

    // 1. Try user-specific permissions
    const { data: userData } = await supabase.from('app_permissions').select('*').eq('id', `user:${userName}`).single();
    if (userData) {
      return { success: true, data: { ...DEFAULT_PERMISSIONS, ...userData } };
    }

    // 2. Fallback to departments
    const deptList = departments.split(',').map((d: string) => d.trim()).filter(Boolean);
    if (deptList.length > 0) {
      const deptIds = deptList.map((d: string) => `dept:${d}`);
      const { data: deptData } = await supabase.from('app_permissions').select('*').in('id', deptIds);
      
      if (deptData && deptData.length > 0) {
        const merged = deptData.reduce((acc: any, curr: any) => {
          const newAcc = { ...acc };
          Object.keys(DEFAULT_PERMISSIONS).forEach(key => {
            if (key === 'allowed_departments') {
              // merge departments string, comma separated
              const currentDepts = (newAcc[key] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
              const incomingDepts = (curr[key] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
              newAcc[key] = Array.from(new Set([...currentDepts, ...incomingDepts])).join(', ');
            } else {
              newAcc[key] = acc[key] || curr[key];
            }
          });
          return newAcc;
        }, { ...DEFAULT_PERMISSIONS });
        return { success: true, data: merged };
      }
    }

    // 3. Default Manager permissions
    if (userRole === 'Manager') {
      return {
        success: true,
        data: {
          ...DEFAULT_PERMISSIONS,
          can_create_orders: true, can_send_orders: true,
          can_receive_orders: true, can_edit_all_orders: true,
          can_add_items_to_orders: true, can_order_all_departments: true,
          can_create_purchasing: true, can_order_purchasing: true, can_receive_purchasing: true,
          can_manage_checklists: true, can_fill_checklists: true,
          can_log_waste: true, can_view_waste_report: true,
          can_manage_hr: false, can_manage_training: true, can_manage_reservations: true,
          can_access_settings: false, can_manage_daily_cash: true, can_manage_tips: true,
          can_punch_clock: true,
          can_view_menu_manual: true, can_view_finance_dashboard: true,
          can_view_86: true, can_manage_86: true,
          can_view_complaints: true, can_manage_complaints: true,
          can_view_upsell: true, can_manage_upsell: true,
          can_view_signin_logs: false,
          can_manage_tasks: true,
          can_view_voids: true,
          can_manage_voids: false,
          can_view_client_orders: true,
          can_manage_client_orders: true,
          can_view_client_reports: true,
          can_view_catalog: true,
          can_manage_catalog: true,
          can_view_suppliers: true,
          can_manage_suppliers: true,
          can_view_price_intelligence: true,
          can_manage_price_intelligence: true,
          can_view_inventory: true,
          can_manage_inventory: true,
          can_manage_attendance: true
        }
      };
    }

    return { success: true, data: { ...DEFAULT_PERMISSIONS, can_view_complaints: true, can_manage_complaints: true, can_view_voids: true, can_manage_voids: true, can_punch_clock: false } };
  },

  // Activity / Audit Logs
  logActivity: async (userName: string, action: string, details: string) => {
    const { error } = await supabase.from('activity_logs').insert([{ user_name: userName, action, details }]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Cash / Shift logs API
  getShiftCashLogs: async (filters: { startDate?: string, endDate?: string, branch?: string }) => {
    let query = supabase.from('shift_cash').select('*').order('date', { ascending: false });
    
    if (filters.branch && filters.branch !== 'All') {
      query = query.ilike('branch', `%${filters.branch.trim()}%`);
    }
    
    if (filters.startDate) {
      const start = filters.startDate.split('T')[0].split(' ')[0];
      query = query.gte('date', start);
    }
    
    if (filters.endDate) {
      const endClean = filters.endDate.split('T')[0].split(' ')[0];
      const parts = endClean.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const nextDayStr = new Date(Date.UTC(year, month, day + 1)).toISOString().split('T')[0];
        query = query.lt('date', nextDayStr);
      } else {
        query = query.lte('date', `${endClean} 23:59:59`);
      }
    }
    
    const rid = getRestaurantId();
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    
    const { data: primaryData, error } = await query;
    if (error) return { success: false, error: error.message };

    const mergedList = Array.from((primaryData || []).values());
    mergedList.sort((a: any, b: any) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // desc
      }
      const createA = a.created_at || '';
      const createB = b.created_at || '';
      return createB.localeCompare(createA); // desc
    });

    return { success: true, data: mergedList };
  },

  // Daily Payments
  getAllDailyPayments: async (filters: { startDate?: string, endDate?: string, branch?: string }) => {
    let query = supabase.from('daily_payments').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    
    if (filters.branch && filters.branch !== 'All') {
      query = query.ilike('branch', `%${filters.branch.trim()}%`);
    }
    
    if (filters.startDate) {
      const start = filters.startDate.split('T')[0].split(' ')[0];
      query = query.gte('date', start);
    }
    
    if (filters.endDate) {
      const endClean = filters.endDate.split('T')[0].split(' ')[0];
      const parts = endClean.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const nextDayStr = new Date(Date.UTC(year, month, day + 1)).toISOString().split('T')[0];
        query = query.lt('date', nextDayStr);
      } else {
        query = query.lte('date', `${endClean} 23:59:59`);
      }
    }

    const rid = getRestaurantId();
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    
    const { data: primaryData, error } = await query;
    if (error) return { success: false, error: error.message };

    const mergedList = Array.from((primaryData || []).values());
    mergedList.sort((a: any, b: any) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const createA = a.created_at || '';
      const createB = b.created_at || '';
      return createB.localeCompare(createA);
    });

    return { success: true, data: mergedList };
  },

  createDailyPayment: async (payload: {
    date: string; branch: string; shift: string; supplier: string;
    amount_usd: number; amount_lbp: number; type: string;
    status: string; has_invoice: boolean; user_name: string;
  }) => {
    const { data, error } = await supabase.from('daily_payments').insert([payload]).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  updateDailyPayment: async (id: string, payload: Partial<{
    date: string; branch: string; shift: string; supplier: string;
    amount_usd: number; amount_lbp: number; type: string;
    status: string; has_invoice: boolean; user_name: string;
  }>) => {
    const { data, error } = await supabase.from('daily_payments').update(payload).eq('id', id).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteDailyPayment: async (id: string) => {
    const { error } = await supabase.from('daily_payments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Tips Employee Update
  updateEmployeeWorkHours: async (employeeId: string, default_daily_hours: number, working_days_per_week: number, tip_factor: number) => {
    const { error } = await supabase.from('employees')
      .update({ default_daily_hours, working_days_per_week, tip_factor })
      .eq('employee_id', employeeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // "86" Daily Missing Items
  get86Logs: async (date: string, branch?: string, conceptId?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('menu_86').select('*');
    if (date) {
      query = query.gte('date', `${date}T00:00:00.000Z`).lte('date', `${date}T23:59:59.999Z`);
    }
    if (branch && branch !== 'All') {
      query = query.eq('branch', branch);
    }
    if (rid) {
      query = query.or(`restaurant_id.eq.${rid},restaurant_id.is.null`);
    }
    if (conceptId && conceptId !== 'ALL') {
      query = query.or(`concept_id.eq.${conceptId},concept_id.is.null`);
    }
    const { data, error } = await query.order('branch');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  save86: async (branch: string, items: any[], date: string, conceptId?: string) => {
    const rid = getRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
    const effectiveConceptId = conceptId || '00000000-0000-0000-0000-000000000001';

    let query = supabase
      .from('menu_86')
      .select('id')
      .eq('branch', branch)
      .gte('date', `${date}T00:00:00.000Z`)
      .lte('date', `${date}T23:59:59.999Z`);

    if (rid) {
      query = query.or(`restaurant_id.eq.${rid},restaurant_id.is.null`);
    }
    if (effectiveConceptId) {
      query = query.or(`concept_id.eq.${effectiveConceptId},concept_id.is.null`);
    }

    const { data: existing, error: findError } = await query.maybeSingle();
    if (findError) return { success: false, error: findError.message };

    if (existing) {
      const { error } = await supabase
        .from('menu_86')
        .update({
          items,
          restaurant_id: rid,
          concept_id: effectiveConceptId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from('menu_86')
        .insert([{
          branch,
          date: `${date}T00:00:00.000Z`,
          items,
          restaurant_id: rid,
          concept_id: effectiveConceptId,
          updated_at: new Date().toISOString()
        }]);
      if (error) return { success: false, error: error.message };
    }

    // Auto-synchronize product catalog status in products table
    try {
      const cleanName = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const newCleanSet = new Set((items || []).map((it: any) => cleanName(it.name)).filter(Boolean));

      let prodQ = supabase.from('products').select('id, name, status, is_active');
      if (rid) prodQ = prodQ.eq('restaurant_id', rid);
      if (effectiveConceptId) prodQ = prodQ.or(`concept_id.eq.${effectiveConceptId},concept_id.is.null`);
      const { data: allProds } = await prodQ;

      if (allProds && allProds.length > 0) {
        const toDisableIds: number[] = [];
        const toEnableIds: number[] = [];

        for (const p of allProds) {
          const pClean = cleanName(p.name);
          const shouldBeUnavailable = newCleanSet.has(pClean);
          const isCurrentlyUnavailable = ['unavailable', 'unavailable today', '86', 'out_of_stock'].includes(String(p.status || '').toLowerCase()) || p.is_active === false;

          if (shouldBeUnavailable && !isCurrentlyUnavailable) {
            toDisableIds.push(p.id);
          } else if (!shouldBeUnavailable && isCurrentlyUnavailable && (p.status === 'Unavailable Today' || p.status === '86')) {
            toEnableIds.push(p.id);
          }
        }

        if (toDisableIds.length > 0) {
          await supabase
            .from('products')
            .update({ status: 'Unavailable Today', is_active: false })
            .in('id', toDisableIds);
        }

        if (toEnableIds.length > 0) {
          await supabase
            .from('products')
            .update({ status: 'Available', is_active: true })
            .in('id', toEnableIds);
        }
      }
    } catch (syncErr) {
      console.warn('[save86] Could not auto-sync product catalog status:', syncErr);
    }

    return { success: true };
  },

  // Dashboard & KPI Analytics RPC call
  getDashboardKpis: async (filters: { date: string; branch: string; department: string }) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('get_dashboard_kpis', {
      p_date: filters.date,
      p_branch: filters.branch,
      p_dept: filters.department,
      p_restaurant_id: rid || null
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Chef Specials / Upsell & Limited QTY API
  getTodaySpecials: async (branch: string) => {
    const rid = getRestaurantId();
    const todayStr = new Date().toISOString().split('T')[0];
    let query = supabase
      .from('chef_specials')
      .select('*')
      .eq('branch', branch)
      .eq('date', todayStr);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.order('recipe_name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveSpecial: async (special: any) => {
    const { error } = await supabase.from('chef_specials').upsert(special);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteSpecial: async (id: string) => {
    const { error } = await supabase.from('chef_specials').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getSpecialsHistory: async (startDate: string, endDate: string, branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('chef_specials')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);
    if (branch && branch !== 'All') {
      query = query.eq('branch', branch);
    }
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    const { data, error } = await query.order('date', { ascending: false }).order('recipe_name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Waste Management
  submitWasteLog: async (wasteData: any) => {
    const wasteId = `WST-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const payload = { ...wasteData, waste_id: wasteId };
    
    const { error } = await supabase.from('waste_logs').insert([payload]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getWasteLogs: async (filters: { branch?: string, department?: string, source?: string, date?: string }) => {
    const rid = getRestaurantId();
    let query = supabase.from('waste_logs').select('*').order('date', { ascending: false });
    
    if (filters.branch && filters.branch !== 'All') {
      query = query.eq('branch', filters.branch);
    }
    if (filters.department && filters.department !== 'All') {
      query = query.ilike('department', `%${filters.department}%`);
    }
    if (filters.source && filters.source !== 'All') {
      query = query.eq('waste_source', filters.source);
    }
    if (filters.date) {
      query = query.gte('date', `${filters.date}T00:00:00.000Z`).lte('date', `${filters.date}T23:59:59.999Z`);
    }
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getVoidReceipts: async (filters: { branch?: string; date?: string }) => {
    const rid = getRestaurantId();
    let query = supabase.from('void_receipts').select('*').order('created_at', { ascending: false });
    
    if (filters.branch && filters.branch !== 'All') {
      query = query.eq('branch', filters.branch);
    }
    if (filters.date) {
      query = query.eq('receipt_date', filters.date);
    }
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Sign-In Log tracking
  getLoginLogs: async (filters?: {
    startDate?: string;
    endDate?: string;
    branch?: string;
    department?: string;
    userName?: string;
    status?: string;
    deviceType?: string;
  }) => {
    const rid = getRestaurantId();
    let query = supabase.from('login_logs').select('*').order('LoginTime', { ascending: false });
    
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    if (filters) {
      if (filters.startDate) query = query.gte('Date', filters.startDate);
      if (filters.endDate) query = query.lte('Date', filters.endDate);
      if (filters.branch && filters.branch !== 'All') query = query.eq('Branch', filters.branch);
      if (filters.department && filters.department !== 'All') query = query.eq('Department', filters.department);
      if (filters.userName && filters.userName !== 'All') query = query.eq('UserName', filters.userName);
      if (filters.status && filters.status !== 'All') query = query.eq('Status', filters.status);
      if (filters.deviceType && filters.deviceType !== 'All') query = query.eq('DeviceType', filters.deviceType);
    }
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getDailyShiftSubmissions: async (filters: {
    branch: string;
    shift: string;
    fromDate: string;
    toDate: string;
  }) => {
    try {
      const rid = getRestaurantId();
      let branches: string[] = [];
      if (filters.branch && filters.branch !== 'All') {
        branches = [filters.branch];
      } else {
        let bQuery = supabase.from('branches').select('name').order('name');
        if (rid) bQuery = bQuery.eq('restaurant_id', rid);
        const { data: branchData, error: branchError } = await bQuery;
        if (branchError) return { success: false, error: branchError.message };
        branches = (branchData || []).map((b: any) => b.name);
      }

      const expectedShifts: any[] = [];
      const start = new Date(filters.fromDate);
      const end = new Date(filters.toDate);
      
      const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff > 90) {
        return { success: false, error: 'Date range cannot exceed 90 days.' };
      }

      const dateArray: string[] = [];
      let current = new Date(start);
      while (current <= end) {
        dateArray.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const shiftsToGenerate = filters.shift === 'All' ? ['AM', 'PM'] : [filters.shift];

      dateArray.forEach(date => {
        branches.forEach(branch => {
          shiftsToGenerate.forEach(shift => {
            expectedShifts.push({ date, branch, shift, status: 'Missing', user: null, time: null });
          });
        });
      });

      let query = supabase
        .from('shift_cash')
        .select('branch, shift, date, created_at, user_name')
        .gte('date', filters.fromDate)
        .lte('date', filters.toDate);

      if (filters.branch && filters.branch !== 'All') query = query.eq('branch', filters.branch);
      if (filters.shift && filters.shift !== 'All') query = query.eq('shift', filters.shift);
      if (rid) query = query.eq('restaurant_id', rid);

      const { data: actualData, error: actualError } = await query;
      if (actualError) return { success: false, error: actualError.message };

      const submissionMap = new Map<string, any>();
      (actualData || []).forEach((record: any) => {
        const key = `${record.date}_${record.branch}_${record.shift}`;
        submissionMap.set(key, record);
      });

      const mergedShifts = expectedShifts.map(expected => {
        const key = `${expected.date}_${expected.branch}_${expected.shift}`;
        const actual = submissionMap.get(key);
        if (actual) {
          let timeOnly = null;
          if (actual.created_at) {
            try {
              const dt = new Date(actual.created_at);
              timeOnly = dt.toTimeString().split(' ')[0].substring(0, 5);
            } catch (e) {
              timeOnly = actual.created_at;
            }
          }
          return { ...expected, status: 'Submitted', user: actual.user_name, time: timeOnly };
        }
        return expected;
      });

      mergedShifts.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
        return a.shift.localeCompare(b.shift);
      });

      return { success: true, data: mergedShifts };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Purchasing Module API
  getPurchasingItems: async (queryStr?: string, department?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('items').select('*').eq('purchasing', 'yes').order('name').limit(5000);
    if (rid) query = query.eq('restaurant_id', rid);
    if (queryStr) query = query.ilike('name', `%${queryStr}%`);
    if (department && department !== 'All') {
      const deptList = department.split(',').map((d: string) => d.trim()).filter(Boolean);
      if (deptList.length > 0) query = query.in('department', deptList);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  savePurchasingItem: async (item: any) => {
    const payload = await injectRestaurantId({ ...item });
    if (payload.id) {
      const { error } = await supabase.from('items').update(payload).eq('id', payload.id);
      if (error) return { success: false, error: error.message };
    } else {
      const defaultSubDepts: Record<string, string> = {
        Bar: 'Coffee', Kitchen: 'Other', Retail: 'Desserts', Supplies: 'Consumables'
      };
      const sub_department = defaultSubDepts[payload.department] || 'Other';
      const insertPayload = { ...payload, purchasing: 'yes', order: 'no', sub_department };
      const { error } = await supabase.from('items').insert([insertPayload]);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  },

  deletePurchasingItem: async (id: string) => {
    const { error } = await supabase.from('items').update({ purchasing: 'no' }).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getPurchasingRequests: async (statusFilter?: string | string[], departmentsFilter?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('purchasing_requests').select('*').order('created_at', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    
    if (statusFilter) {
      if (Array.isArray(statusFilter)) {
        query = query.in('status', statusFilter);
      } else if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }
    }

    if (departmentsFilter && departmentsFilter !== 'All') {
      const deptList = departmentsFilter.split(',').map((d: string) => d.trim()).filter(Boolean);
      if (deptList.length > 0) query = query.in('department', deptList);
    }
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getPurchasingRequestItems: async (requestId: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('purchasing_request_items').select('*').eq('purchasing_request_id', requestId);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.order('item_name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getAllPurchasingRequestItems: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('purchasing_request_items').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getSupplierQuotations: async () => {
    const { data, error } = await supabase.from('supplier_quotations').select('*').order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveSupplierQuotation: async (quotation: any) => {
    const { data, error } = await supabase.from('supplier_quotations').upsert(quotation).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteSupplierQuotation: async (id: string) => {
    const { error } = await supabase.from('supplier_quotations').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getSupplierEvaluations: async () => {
    const { data, error } = await supabase.from('supplier_evaluations').select('*').order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveSupplierEvaluation: async (evaluation: any) => {
    const { data, error } = await supabase.from('supplier_evaluations').upsert(evaluation).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getSupplierIntelligenceConfig: async () => {
    const { data, error } = await supabase.from('supplier_intelligence_config').select('*').limit(1);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] || null };
  },

  saveSupplierIntelligenceConfig: async (config: any) => {
    const { data, error } = await supabase.from('supplier_intelligence_config').upsert(config).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getItemDescriptionMappings: async () => {
    const { data, error } = await supabase.from('item_description_mappings').select('*').order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveItemDescriptionMapping: async (mapping: any) => {
    const { data, error } = await supabase.from('item_description_mappings').upsert(mapping).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  savePurchasingRequest: async (header: any, items: any[]) => {
    let requestId = header.id;
    
    if (!requestId) {
      const { data, error } = await supabase.from('purchasing_requests').insert([header]).select('id').single();
      if (error) return { success: false, error: error.message };
      requestId = data.id;
    } else {
      const { error } = await supabase.from('purchasing_requests').update(header).eq('id', requestId);
      if (error) return { success: false, error: error.message };
    }
    
    if (header.id) {
      await supabase.from('purchasing_request_items').delete().eq('purchasing_request_id', requestId);
    }
    
    const itemsPayload = items.map((i: any) => ({
      purchasing_request_id: requestId,
      item_name: i.item_name || i.name,
      unit: i.unit,
      qty_requested: i.qty_requested || 0,
      qty_ordered: i.qty_ordered || 0,
      qty_received: i.qty_received || 0,
      price: i.price !== undefined ? Number(i.price) : 0,
      vat: i.vat !== undefined ? Number(i.vat) : 0
    }));

    const { error: itemsError } = await supabase.from('purchasing_request_items').insert(itemsPayload);
    if (itemsError) return { success: false, error: itemsError.message };

    if (header.status === 'Ordered') {
      const zeroOrderedItems = items.filter((i: any) => (Number(i.qty_ordered) === 0 || !i.qty_ordered) && Number(i.qty_requested) > 0);
      if (zeroOrderedItems.length > 0) {
        const foHeader = {
          purchasing_id: header.purchasing_id + '-FO',
          department: header.department,
          branch: header.branch,
          user_name: header.user_name || 'SYSTEM',
          status: 'Submitted',
          created_at: new Date().toISOString(),
          comments: `Unordered items follow-up from request ${header.purchasing_id}`
        };

        const { data: foData, error: foErr } = await supabase
          .from('purchasing_requests')
          .insert([foHeader])
          .select('id')
          .single();

        if (!foErr && foData) {
          const foItemsPayload = zeroOrderedItems.map((i: any) => ({
            purchasing_request_id: foData.id,
            item_name: i.item_name || i.name,
            unit: i.unit,
            qty_requested: i.qty_requested || 0,
            qty_ordered: 0,
            qty_received: 0
          }));
          await supabase.from('purchasing_request_items').insert(foItemsPayload);
        }
      }
    }

    return { success: true, data: requestId };
  },

  deletePurchasingRequest: async (purchasingId: string, userName: string, details: any) => {
    await supabase.from('activity_logs').insert([{
      user_name: userName,
      action: 'DELETE_PURCHASING_ORDER',
      details: `Deleted purchasing request ${purchasingId} details: ${JSON.stringify(details)}`
    }]);

    const { error } = await supabase.from('purchasing_requests').delete().eq('purchasing_id', purchasingId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deletePurchasingRequestItem: async (itemId: string, purchasingId: string, userName: string, itemDetails: any) => {
    await supabase.from('activity_logs').insert([{
      user_name: userName,
      action: 'DELETE_PURCHASING_ITEM',
      details: `Deleted item from purchasing order ${purchasingId}: ${JSON.stringify(itemDetails)}`
    }]);

    const { error } = await supabase.from('purchasing_request_items').delete().eq('id', itemId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  processPurchasingBackorder: async (originalHeader: any, originalItems: any[], missingItems: any[], userName: string) => {
    const receivedHeaderUpdate = { status: 'Received', received_by: userName, date_received: new Date().toISOString() };
    const { error: hErr } = await supabase.from('purchasing_requests').update(receivedHeaderUpdate).eq('id', originalHeader.id);
    if (hErr) return { success: false, error: hErr.message };

    for (const item of originalItems) {
      await supabase.from('purchasing_request_items').update({ 
        qty_received: item.qty_received,
        price: item.price !== undefined ? Number(item.price) : 0,
        vat: item.vat !== undefined ? Number(item.vat) : 0
      }).eq('id', item.id);
    }

    if (missingItems && missingItems.length > 0) {
      const backorderHeader = {
        purchasing_id: originalHeader.purchasing_id + '-BO',
        department: originalHeader.department,
        branch: originalHeader.branch,
        user_name: 'SYSTEM (Backorder)',
        status: 'Submitted',
        created_at: new Date().toISOString(),
        comments: `Auto-generated backorder from ${originalHeader.purchasing_id}`
      };

      const { data: boData, error: boErr } = await supabase.from('purchasing_requests').insert([backorderHeader]).select('id').single();
      if (boErr) return { success: false, error: boErr.message };

      const boItemsPayload = missingItems.map((i: any) => ({
        purchasing_request_id: boData.id,
        item_name: i.item_name,
        unit: i.unit,
        qty_requested: i.qty_missing,
        qty_ordered: 0,
        qty_received: 0,
        status: 'Active'
      }));

      await supabase.from('purchasing_request_items').insert(boItemsPayload);
    }

    return { success: true };
  },

  // Ordering Module API
  getOrders: async (filters: { branch?: string; to_branch?: string; status?: string | string[]; urgent?: boolean }) => {
    const rid = getRestaurantId();
    let query = supabase.from('orders').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    
    if (filters.branch && filters.branch !== 'All') query = query.eq('branch', filters.branch);
    if (filters.to_branch && filters.to_branch !== 'All') query = query.eq('to_branch', filters.to_branch);
    
    if (filters.status && filters.status !== 'All') {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.urgent !== undefined && filters.urgent !== false) {
      query = query.eq('urgent', filters.urgent);
    }
    
    const { data: orders, error: ordersError } = await query.order('date_submitted', { ascending: false });
    if (ordersError) return { success: false, error: ordersError.message };

    if (!orders || orders.length === 0) {
      return { success: true, data: [] };
    }

    const orderIds = orders.map(o => o.id);
    let itemsQuery = supabase.from('order_items').select('*').in('order_id', orderIds);
    if (rid) itemsQuery = itemsQuery.eq('restaurant_id', rid);
    const { data: items, error: itemsError } = await itemsQuery;
    
    if (itemsError) return { success: false, error: itemsError.message };

    const itemsByOrderId = new Map();
    items?.forEach(item => {
      if (!itemsByOrderId.has(item.order_id)) {
        itemsByOrderId.set(item.order_id, []);
      }
      itemsByOrderId.get(item.order_id).push(item);
    });

    const joinedOrders = orders.map(order => ({
      ...order,
      order_items: itemsByOrderId.get(order.id) || []
    }));

    return { success: true, data: joinedOrders };
  },

  updateOrder: async (orderId: string, updates: any, itemsUpdates?: any[], newItems?: any[]) => {
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
      if (error) return { success: false, error: error.message };
    }
    
    if (itemsUpdates && itemsUpdates.length > 0) {
      for (const item of itemsUpdates) {
        const { error: itemError } = await supabase.from('order_items').update(item.updates).eq('id', item.id);
        if (itemError) return { success: false, error: `Item update failed: ${itemError.message}` };
      }
    }
    
    if (newItems && newItems.length > 0) {
      const { error: newItemsError } = await supabase.from('order_items').insert(newItems);
      if (newItemsError) return { success: false, error: newItemsError.message };
    }
    
    return { success: true };
  },

  createFollowUpOrder: async (originalOrder: any, items: any[], type: string = 'Follow-up') => {
    const newOrderId = `FO-${Math.floor(Math.random() * 900000) + 100000}`;
    const { error: orderError } = await supabase.from('orders').insert({
      id: newOrderId,
      branch: originalOrder.branch,
      to_branch: originalOrder.to_branch,
      to_department: originalOrder.to_department,
      urgent: originalOrder.urgent || false,
      placed_by: `System (${type})`,
      status: 'Submitted',
      date_submitted: new Date().toISOString(),
    });

    if (orderError) return { success: false, error: orderError.message };

    const orderItems = items.map((item: any) => ({
      order_id: newOrderId,
      item_name: item.item_name,
      quantity: item.quantity, 
      unit: item.unit,
      urgent: item.urgent || false
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) return { success: false, error: itemsError.message };
    return { success: true, id: newOrderId };
  },

  deleteOrder: async (orderId: string, userName: string) => {
    await supabase.from('activity_logs').insert([{
      user_name: userName,
      action: 'DELETE_ORDER',
      details: `Deleted order ${orderId}`
    }]);

    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getItemSentToBranchHistory: async (itemName: string, toBranch: string) => {
    try {
      const rid = getRestaurantId();
      let query = supabase
        .from('orders')
        .select('*')
        .eq('to_branch', toBranch)
        .in('status', ['Sent', 'Received']);
      if (rid) query = query.eq('restaurant_id', rid);

      const { data: orders, error: ordersError } = await query;

      if (ordersError) return { success: false, error: ordersError.message };

      if (!orders || orders.length === 0) {
        return { success: true, data: [] };
      }

      const orderIds = orders.map(o => o.id);
      let itemsQuery = supabase
        .from('order_items')
        .select('*')
        .eq('item_name', itemName)
        .gt('qty_sent', 0)
        .in('order_id', orderIds);
      if (rid) itemsQuery = itemsQuery.eq('restaurant_id', rid);
      const { data: items, error: itemsError } = await itemsQuery;

      if (itemsError) return { success: false, error: itemsError.message };

      const ordersMap = new Map();
      orders.forEach(o => ordersMap.set(o.id, o));

      const joinedItems = (items || []).map(item => ({
        ...item,
        orders: ordersMap.get(item.order_id) || null
      })).filter(item => item.orders !== null);

      const sortedData = joinedItems.sort((a: any, b: any) => {
        const dateA = a.orders?.date_sent ? new Date(a.orders.date_sent).getTime() : 0;
        const dateB = b.orders?.date_sent ? new Date(b.orders.date_sent).getTime() : 0;
        return dateB - dateA;
      });

      return { success: true, data: sortedData };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getOrderCatalogItems: async (queryStr?: string, department?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('items').select('*').eq('order', 'yes').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    if (queryStr) query = query.ilike('name', `%${queryStr}%`);
    if (department && department !== 'All') {
      const deptList = department.split(',').map((d: string) => d.trim()).filter(Boolean);
      if (deptList.length > 0) query = query.in('department', deptList);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveOrderCatalogItem: async (item: any) => {
    const payload = await injectRestaurantId({ ...item });
    if (payload.id) {
      const { error } = await supabase.from('items').update(payload).eq('id', payload.id);
      if (error) return { success: false, error: error.message };
    } else {
      const defaultSubDepts: Record<string, string> = {
        Bar: 'Coffee', Kitchen: 'Other', Retail: 'Desserts', Supplies: 'Consumables'
      };
      const sub_department = defaultSubDepts[payload.department] || 'Other';
      const insertPayload = { ...payload, order: 'yes', purchasing: 'no', sub_department };
      const { error } = await supabase.from('items').insert([insertPayload]);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  },

  deleteOrderCatalogItem: async (id: string) => {
    const { error } = await supabase.from('items').update({ order: 'no' }).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Reservations Module API
  getClients: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('clients').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  searchClients: async (query: string) => {
    const rid = getRestaurantId();
    let qBuilder = supabase.from('clients').select('*');
    if (rid) qBuilder = qBuilder.eq('restaurant_id', rid);
    qBuilder = qBuilder.or(`name.ilike.%${query}%,phone.ilike.%${query}%`).limit(10);
    const { data, error } = await qBuilder;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  createClient: async (client: any) => {
    const payload = await injectRestaurantId({ ...client });
    const { data, error } = await supabase.from('clients').insert(payload).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getBranches: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('branches').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveBranch: async (capacity: any) => {
    const payload = await injectRestaurantId({ ...capacity });
    const { error } = await supabase.from('branches').upsert(payload, { onConflict: 'name' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteBranch: async (name: string) => {
    const rid = getRestaurantId();
    let qTips = supabase.from('tips_settings').delete().eq('branch', name);
    if (rid) qTips = qTips.eq('restaurant_id', rid);
    await qTips;

    let qShifts = supabase.from('branch_shifts').delete().eq('branch', name);
    if (rid) qShifts = qShifts.eq('restaurant_id', rid);
    await qShifts;

    let query = supabase.from('branches').delete().eq('name', name);
    if (rid) query = query.eq('restaurant_id', rid);
    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // ── Branch Shifts ──
  getBranchShifts: async (branch?: string) => {
    const rid = getRestaurantId();
    let q = supabase
      .from('branch_shifts')
      .select('*')
      .order('branch')
      .order('start_time');
    if (branch && branch !== 'All') q = q.eq('branch', branch);
    if (rid) q = q.eq('restaurant_id', rid);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveBranchShift: async (payload: {
    id?: string;
    branch: string;
    shift_name: string;
    start_time: string; // HH:MM:SS
    end_time: string;   // HH:MM:SS  (can be < start_time → crosses midnight)
  }) => {
    if (payload.id) {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('branch_shifts').update(rest).eq('id', id);
      if (error) return { success: false, error: error.message };
    } else {
      // Explicitly omit `id` so the DB default (gen_random_uuid()) is used
      const { id: _omit, ...insertPayload } = payload;
      const { error } = await supabase.from('branch_shifts').insert([insertPayload]);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  },

  deleteBranchShift: async (id: string) => {
    const { error } = await supabase.from('branch_shifts').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getReservations: async (branch: string, date: string, includeDeleted: boolean = false) => {
    const rid = getRestaurantId();
    let resQuery = supabase
      .from('reservations')
      .select('*')
      .eq('reservation_date', date);
    if (!includeDeleted) {
      resQuery = resQuery.or('is_deleted.eq.false,is_deleted.is.null').neq('status', 'Deleted');
    }
    if (branch && branch !== 'All') {
      resQuery = resQuery.ilike('branch', branch);
    }
    if (rid) resQuery = resQuery.eq('restaurant_id', rid);
    const { data: reservations, error: reservationsError } = await resQuery.order('reservation_time');
    
    if (reservationsError) return { success: false, error: reservationsError.message };

    if (!reservations || reservations.length === 0) {
      return { success: true, data: [] };
    }

    const clientIds = reservations.map(r => r.client_id).filter(Boolean);
    let clients: any[] = [];
    if (clientIds.length > 0) {
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .in('id', clientIds);
      if (rid) clientsQuery = clientsQuery.eq('restaurant_id', rid);
      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) return { success: false, error: clientsError.message };
      clients = clientsData || [];
    }

    const clientsMap = new Map();
    clients.forEach(c => clientsMap.set(c.id, c));

    const joinedReservations = reservations.map(res => ({
      ...res,
      clients: res.client_id ? (clientsMap.get(res.client_id) || null) : null
    }));

    return { success: true, data: joinedReservations };
  },

  saveReservation: async (reservation: any) => {
    const { error } = await supabase.from('reservations').upsert(reservation);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  updateReservation: async (id: string, updates: any) => {
    const { error } = await supabase.from('reservations').update(updates).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
  
  cancelReservation: async (id: string, reason: string) => {
    const { error } = await supabase.from('reservations').update({ status: 'Cancelled', cancel_reason: reason }).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteReservation: async (id: string, cancelReason: string = 'Marked as Deleted') => {
    const { error } = await supabase.from('reservations').update({
      is_deleted: true,
      status: 'Deleted',
      cancel_reason: cancelReason
    }).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Supplier Module API
  getSuppliers: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('suppliers').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveSupplier: async (supplier: any) => {
    const payload = await injectRestaurantId({ ...supplier });
    const { error } = await supabase.from('suppliers').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteSupplier: async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Daily Checklists API
  getChecklists: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('checklists').select('*').order('created_at', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveChecklist: async (checklist: any) => {
    if (checklist.id) {
      const { error } = await supabase.from('checklists').update(checklist).eq('id', checklist.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase.from('checklists').insert([checklist]);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  },

  deleteChecklist: async (id: string) => {
    const { error } = await supabase.from('checklists').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getChecklistSubmissions: async (branchFilter?: string, departmentFilter?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('checklist_submissions').select('*').order('date_submitted', { ascending: false });
    if (branchFilter && branchFilter !== 'All') query = query.eq('branch', branchFilter);
    if (departmentFilter && departmentFilter !== 'All') query = query.eq('department', departmentFilter);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getSubDepartmentsList: async (departmentName?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('sub_departments').select('id, department_name, name').order('name');
    if (departmentName) query = query.eq('department_name', departmentName);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getAllCatalogItems: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('items').select('*').order('name').limit(5000);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveCatalogItem: async (item: any) => {
    const payload = await injectRestaurantId({ ...item });
    const { error } = await supabase.from('items').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  updateItemPrice: async (itemId: string, priceUsd: number) => {
    const { error } = await supabase
      .from('items')
      .update({ price_usd: priceUsd })
      .eq('id', itemId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  updateItemSupplier: async (itemId: string, supplierId: string | null, deliveryTime?: string | null) => {
    const updatePayload: any = { supplier_id: supplierId || null };
    if (deliveryTime) {
      updatePayload.delivery_time = deliveryTime;
    }
    const { error } = await supabase
      .from('items')
      .update(updatePayload)
      .eq('id', itemId);
    if (error) return { success: false, error: error.message };

    try {
      await supabase
        .from('supplier_price_lists')
        .update({ supplier_id: supplierId || null })
        .eq('item_id', itemId)
        .eq('is_default', true);
    } catch {}

    return { success: true };
  },

  checkCatalogItemUsage: async (id: string) => {
    try {
      // 1. Menu Recipes (via recipe_components)
      const { data: menuRecs } = await supabase
        .from('recipe_components')
        .select('recipe_id, menu_recipes:recipe_id(id, item_name)')
        .eq('item_id', id);

      const recipes: Array<{ id: string; name: string }> = [];
      const seenRecIds = new Set<string>();
      (menuRecs || []).forEach((r: any) => {
        const rId = r.recipe_id;
        const name = r.menu_recipes?.item_name || `Recipe #${rId}`;
        if (rId && !seenRecIds.has(rId)) {
          seenRecIds.add(rId);
          recipes.push({ id: rId, name });
        }
      });

      // 2. Production recipes (as ingredient or output)
      const { data: prodRecs } = await supabase
        .from('production_recipe_items')
        .select('production_recipe_id, production_recipes:production_recipe_id(id, name)')
        .eq('item_id', id);

      const { data: prodOutputs } = await supabase
        .from('production_recipes')
        .select('id, name')
        .eq('output_item_id', id);

      const productionRecipes: Array<{ id: string; name: string; role: 'ingredient' | 'output' }> = [];
      const seenProdIds = new Set<string>();
      (prodRecs || []).forEach((r: any) => {
        const pId = r.production_recipe_id;
        const name = r.production_recipes?.name || `Prep Recipe #${pId}`;
        if (pId && !seenProdIds.has(pId)) {
          seenProdIds.add(pId);
          productionRecipes.push({ id: pId, name, role: 'ingredient' });
        }
      });
      (prodOutputs || []).forEach((r: any) => {
        const pId = r.id;
        const name = r.name || `Prep Recipe #${pId}`;
        if (pId && !seenProdIds.has(pId)) {
          seenProdIds.add(pId);
          productionRecipes.push({ id: pId, name, role: 'output' });
        }
      });

      // 3. Modifier inventory effects
      const { data: modEffects } = await supabase
        .from('modifier_inventory_effects')
        .select('id, effect_type, quantity_delta, unit, product_customization_id, customization_item_id, product_customizations:product_customization_id(id, ingredient, product_id)')
        .eq('item_id', id);

      const modifiers: Array<{ id: string; name: string; productName?: string }> = [];
      if (modEffects && modEffects.length > 0) {
        const prodIds = [...new Set(modEffects.map((m: any) => m.product_customizations?.product_id).filter(Boolean))];
        let prodMap = new Map<number, string>();
        if (prodIds.length > 0) {
          const { data: prods } = await supabase.from('products').select('id, name').in('id', prodIds);
          (prods || []).forEach((p: any) => prodMap.set(p.id, p.name));
        }

        modEffects.forEach((m: any) => {
          const ing = m.product_customizations?.ingredient || 'Modifier Effect';
          const pName = m.product_customizations?.product_id ? prodMap.get(m.product_customizations.product_id) : undefined;
          modifiers.push({
            id: m.id,
            name: ing,
            productName: pName
          });
        });
      }

      // 4. Product inventory item mappings (direct finished good mapping)
      const { data: mappings } = await supabase
        .from('product_inventory_item_mappings')
        .select('id, product_id')
        .eq('item_id', id);

      const productMappings: Array<{ id: string; productName: string }> = [];
      if (mappings && mappings.length > 0) {
        const pIds = mappings.map((m: any) => m.product_id).filter(Boolean);
        if (pIds.length > 0) {
          const { data: prods } = await supabase.from('products').select('id, name').in('id', pIds);
          const pMap = new Map((prods || []).map((p: any) => [p.id, p.name]));
          mappings.forEach((m: any) => {
            productMappings.push({
              id: m.id,
              productName: pMap.get(m.product_id) || `Product #${m.product_id}`
            });
          });
        }
      }

      // 5. Packaging options (supplier_price_lists) & Unit conversions
      const { count: packagingCount } = await supabase
        .from('supplier_price_lists')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', id);

      const { count: conversionCount } = await supabase
        .from('item_unit_conversions')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', id);

      const hasActiveRecipes = recipes.length > 0 || productionRecipes.length > 0;
      const inUse = hasActiveRecipes || modifiers.length > 0 || productMappings.length > 0 || (packagingCount || 0) > 0 || (conversionCount || 0) > 0;

      return {
        success: true,
        inUse,
        hasActiveRecipes,
        recipes,
        productionRecipes,
        modifiers,
        productMappings,
        packagingCount: packagingCount || 0,
        conversionCount: conversionCount || 0
      };
    } catch (e: any) {
      console.error('Error checking item usage:', e);
      return {
        success: false,
        error: e.message,
        inUse: false,
        hasActiveRecipes: false,
        recipes: [],
        productionRecipes: [],
        modifiers: [],
        productMappings: [],
        packagingCount: 0,
        conversionCount: 0
      };
    }
  },

  deleteCatalogItem: async (id: string, options?: { force?: boolean }) => {
    try {
      // If not forced, check if it's used in active recipes
      if (!options?.force) {
        const usageRes = await api.checkCatalogItemUsage(id);
        if (usageRes.success && usageRes.hasActiveRecipes) {
          const recNames = [
            ...usageRes.recipes.map(r => r.name),
            ...usageRes.productionRecipes.map(r => r.name)
          ].join(', ');
          return {
            success: false,
            inUse: true,
            hasActiveRecipes: true,
            error: `Cannot delete item because it is actively used in recipes: ${recNames}. Please remove it from those recipes first.`
          };
        }
      }

      // Safe cascade cleanup to avoid foreign key constraint violations
      if (options?.force) {
        await supabase.from('recipe_components').delete().eq('item_id', id);
        await supabase.from('production_recipe_items').delete().eq('item_id', id);
        await supabase.from('production_recipes').update({ output_item_id: null }).eq('output_item_id', id);
      }

      // Unlink modifier inventory effects
      await supabase.from('modifier_inventory_effects').delete().eq('item_id', id);

      // Remove product inventory mappings
      await supabase.from('product_inventory_item_mappings').delete().eq('item_id', id);

      // Remove supplier price lists / packaging options
      await supabase.from('supplier_price_lists').delete().eq('item_id', id);

      // Remove unit conversions
      await supabase.from('item_unit_conversions').delete().eq('item_id', id);

      // Remove stock balances
      try {
        await supabase.from('inventory_stock_balances').delete().eq('item_id', id);
      } catch {}

      // Remove replenishment recommendations & history
      try {
        await supabase.from('replenishment_recommendation_items').delete().eq('item_id', id);
        await supabase.from('replenishment_decision_history').delete().eq('item_id', id);
        await supabase.from('inventory_item_replenishment').delete().eq('item_id', id);
      } catch {}

      // Delete the item itself
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) return { success: false, error: error.message };

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  saveDepartment: async (dept: { id?: number, name: string }) => {
    const payload = await injectRestaurantId({ ...dept });
    const { error } = await supabase.from('departments').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteDepartment: async (id: number) => {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  saveSubDepartment: async (subDept: { id?: number, department_name: string, name: string }) => {
    const payload = await injectRestaurantId({ ...subDept });
    const { error } = await supabase.from('sub_departments').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteSubDepartment: async (id: number) => {
    const { error } = await supabase.from('sub_departments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // TASK MANAGEMENT / MANAGER TO-DO API
  getTasks: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveTask: async (task: any) => {
    if (task.task_id) {
      const { error } = await supabase.from('tasks').update(task).eq('task_id', task.task_id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase.from('tasks').insert([task]);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  },

  deleteTask: async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('task_id', taskId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  uploadTaskPhoto: async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `tasks/${fileName}`;
      const { error } = await supabase.storage.from('checklists').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (error) return { success: false, error: error.message };
      
      const { data: { publicUrl } } = supabase.storage.from('checklists').getPublicUrl(filePath);
      return { success: true, url: publicUrl };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getGlobalNotificationSettings: async () => {
    const rid = getRestaurantId();
    let query = supabase
      .from('app_settings')
      .select('*')
      .eq('setting_key', 'notifications');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveGlobalNotificationSettings: async (settings: any) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        setting_key: 'notifications',
        setting_value: typeof settings === 'string' ? settings : JSON.stringify(settings),
        updated_at: new Date().toISOString()
      });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getExchangeRate: async (restaurantId?: string) => {
    if (restaurantId) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .single();
      if (!error && data?.settings) {
        const settings = data.settings as any;
        if (settings.exchange_rate !== undefined) {
          return { success: true, rate: parseFloat(settings.exchange_rate) };
        }
      }
    }
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'exchange_rate')
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, rate: data ? parseFloat(data.setting_value) : 90000 };
  },

  updateExchangeRate: async (rate: number) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        setting_key: 'exchange_rate',
        setting_value: rate.toString(),
        updated_at: new Date().toISOString()
      });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getVatRate: async (restaurantId?: string) => {
    if (restaurantId) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .single();
      if (!error && data?.settings) {
        const settings = data.settings as any;
        if (settings.vat_rate !== undefined) {
          return { success: true, rate: parseFloat(settings.vat_rate) };
        }
      }
    }
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'vat_rate')
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, rate: data ? parseFloat(data.setting_value) : 11 };
  },

  getVatSettings: async (restaurantId?: string) => {
    let isSubscribed = false;
    let vatRate = 11;
    let isVatInclusive = false;
    const rid = restaurantId || getRestaurantId();

    if (rid) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', rid)
        .maybeSingle();

      if (!error && data?.settings) {
        const settings = data.settings as any;
        if (settings.is_vat_subscribed !== undefined) {
          isSubscribed = settings.is_vat_subscribed === true;
        }
        if (settings.vat_rate !== undefined && Number(settings.vat_rate) >= 0) {
          vatRate = parseFloat(settings.vat_rate);
        }
        if (settings.is_vat_inclusive !== undefined) {
          isVatInclusive = Boolean(settings.is_vat_inclusive);
        } else if (settings.vat_treatment === 'INCLUSIVE' || settings.prices_include_vat === true) {
          isVatInclusive = true;
        }
      }
    }

    // Fallback check from app_settings
    const { data: appData } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['vat_rate', 'is_vat_subscribed', 'is_vat_inclusive', 'vat_treatment']);

    if (appData && appData.length > 0) {
      const appVat = appData.find(s => s.setting_key === 'vat_rate');
      if (appVat && parseFloat(appVat.setting_value) >= 0 && vatRate === 11) {
        vatRate = parseFloat(appVat.setting_value);
      }
      const appSub = appData.find(s => s.setting_key === 'is_vat_subscribed');
      if (appSub && !isSubscribed) {
        isSubscribed = appSub.setting_value === 'true' || appSub.setting_value === '1';
      }
      const appInc = appData.find(s => s.setting_key === 'is_vat_inclusive' || s.setting_key === 'vat_treatment');
      if (appInc) {
        isVatInclusive = appInc.setting_value === 'true' || appInc.setting_value === 'INCLUSIVE';
      }
    }

    return {
      success: true,
      isVatSubscribed: isSubscribed,
      vatRate,
      isVatInclusive,
      vatTreatment: !isSubscribed ? 'DISABLED' : (isVatInclusive ? 'INCLUSIVE' : 'EXCLUSIVE')
    };
  },

  updateVatRate: async (rate: number) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        setting_key: 'vat_rate',
        setting_value: rate.toString(),
        updated_at: new Date().toISOString()
      });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Complaints Module API
  getComplaints: async (filters?: { branch?: string; status?: string; category?: string; startDate?: string; endDate?: string }) => {
    const rid = getRestaurantId();
    let query = supabase.from('ClientComplaints').select('*').order('DateCreated', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    if (filters) {
      if (filters.branch && filters.branch !== 'All') query = query.eq('Branch', filters.branch);
      if (filters.status && filters.status !== 'All') query = query.eq('Status', filters.status);
      if (filters.category && filters.category !== 'All') query = query.eq('Category', filters.category);
      if (filters.startDate) query = query.gte('DateCreated', filters.startDate);
      if (filters.endDate) query = query.lte('DateCreated', filters.endDate + 'T23:59:59');
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getComplaintById: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('ClientComplaints').select('*').eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveComplaint: async (complaint: any) => {
    if (complaint.id) {
      const { error } = await supabase.from('ClientComplaints').update(complaint).eq('id', complaint.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase.from('ClientComplaints').insert([complaint]);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  },

  uploadComplaintAttachment: async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('complaint-attachments').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (error) return { success: false, error: error.message };
      const { data: publicUrlData } = supabase.storage.from('complaint-attachments').getPublicUrl(fileName);
      return { success: true, url: publicUrlData.publicUrl, fileName: file.name };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // News Management API
  getNews: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('news').select('*').order('created_at', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  addNewsItem: async (item: any) => {
    const { error } = await supabase.from('news').insert([item]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  updateNewsItem: async (id: string, updates: any) => {
    const { error } = await supabase.from('news').update(updates).eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Finance / Analytics API
  getFinancialData: async (filters: { startDate: string; endDate: string; branch?: string }) => {
    let query = supabase.from('shift_cash').select('*').gte('date', filters.startDate).lte('date', filters.endDate);
    if (filters.branch && filters.branch !== 'All') query = query.eq('branch', filters.branch);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Client History Stats (CRM)
  getClientHistoryStats: async (clientId: string) => {
    try {
      const { data: orders, error: ordersErr } = await supabase
        .from('client_orders')
        .select('*')
        .eq('client_id', clientId);
        
      if (ordersErr) return { success: false, error: ordersErr.message };
      
      const orderIds = (orders || []).map((o: any) => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('client_order_items')
          .select('*')
          .in('order_id', orderIds);
        items = itemsData || [];
      }
      
      const totalOrders = orders.length;
      const completedOrders = orders.filter((o: any) => o.status !== 'Cancelled');
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (Number(o.grand_total) || 0), 0);
      
      const lastOrderDate = orders.length > 0 
        ? [...orders].sort((a: any, b: any) => b.order_date.localeCompare(a.order_date))[0].order_date 
        : 'None';
        
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const openOpportunitiesCount = orders.filter((o: any) => ['Inquiry', 'Quotation Sent'].includes(o.status)).length;
      
      const productQtyMap: Record<string, number> = {};
      items.forEach((item: any) => {
        const name = item.item_name;
        const qty = Number(item.qty) || 0;
        productQtyMap[name] = (productQtyMap[name] || 0) + qty;
      });
      
      const favoriteProducts = Object.entries(productQtyMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)
        .join(', ') || 'None';
        
      return {
        success: true,
        data: { totalOrders, totalRevenue, lastOrderDate, avgOrderValue, openOpportunities: openOpportunitiesCount, favoriteProducts }
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // CLIENT ORDERS CRM MODULE
  saveClient: async (client: any) => {
    const payload = await injectRestaurantId({ ...client });
    const { data, error } = await supabase.from('clients').upsert(payload).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getClientOrders: async (filters?: { startDate?: string; endDate?: string; branch?: string; category?: string; status?: string; salesperson?: string; clientId?: string }) => {
    const rid = getRestaurantId();
    let query = supabase.from('client_orders').select('*').order('created_at', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    
    if (filters) {
      if (filters.branch && filters.branch !== 'All') query = query.eq('branch', filters.branch);
      if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
      if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
      if (filters.salesperson && filters.salesperson !== 'All') query = query.eq('salesperson', filters.salesperson);
      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      if (filters.startDate) query = query.gte('order_date', filters.startDate);
      if (filters.endDate) query = query.lte('order_date', filters.endDate);
    }
    
    const { data: orders, error: ordersError } = await query;
    if (ordersError) return { success: false, error: ordersError.message };

    if (!orders || orders.length === 0) {
      return { success: true, data: [] };
    }

    const clientIds = orders.map(o => o.client_id).filter(Boolean);
    let clients: any[] = [];
    if (clientIds.length > 0) {
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .in('id', clientIds);
      if (rid) clientsQuery = clientsQuery.eq('restaurant_id', rid);
      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) return { success: false, error: clientsError.message };
      clients = clientsData || [];
    }

    const clientsMap = new Map();
    clients.forEach(c => clientsMap.set(c.id, c));

    const joinedOrders = orders.map(order => ({
      ...order,
      clients: order.client_id ? (clientsMap.get(order.client_id) || null) : null
    }));

    return { success: true, data: joinedOrders };
  },

  getClientOrderDetails: async (orderId: string) => {
    const rid = getRestaurantId();
    let orderQuery = supabase.from('client_orders').select('*').eq('id', orderId);
    let itemsQuery = supabase.from('client_order_items').select('*').eq('order_id', orderId);
    let tasksQuery = supabase.from('client_order_tasks').select('*').eq('order_id', orderId);
    let attachmentsQuery = supabase.from('client_order_attachments').select('*').eq('order_id', orderId);

    if (rid) {
      orderQuery = orderQuery.eq('restaurant_id', rid);
      itemsQuery = itemsQuery.eq('restaurant_id', rid);
      tasksQuery = tasksQuery.eq('restaurant_id', rid);
      attachmentsQuery = attachmentsQuery.eq('restaurant_id', rid);
    }

    const [orderRes, itemsRes, tasksRes, attachmentsRes] = await Promise.all([
      orderQuery.single(),
      itemsQuery,
      attachmentsQuery.then(async att => {
        // Wait, attachments doesn't strictly need tasksRes inside it, we group tasksRes together.
        return att;
      }),
      tasksQuery
    ]);

    // To preserve original array indices from Promise.all (orderRes, itemsRes, tasksRes, attachmentsRes):
    // orderRes is index 0. itemsRes is index 1. tasksRes is index 3. attachmentsRes is index 2.
    // Let's write this cleanly:
    const tasksData = tasksRes.data || [];
    const attachmentsData = attachmentsRes.data || [];

    if (orderRes.error) return { success: false, error: orderRes.error.message };

    const order = orderRes.data;
    let client = null;
    if (order && order.client_id) {
      let clientQuery = supabase
        .from('clients')
        .select('*')
        .eq('id', order.client_id);
      if (rid) clientQuery = clientQuery.eq('restaurant_id', rid);
      const { data: clientData } = await clientQuery.maybeSingle();
      client = clientData;
    }

    const orderWithClient = {
      ...order,
      clients: client
    };

    const fetchedTasks = tasksData;
    for (let i = 0; i < fetchedTasks.length; i++) {
      const task = fetchedTasks[i];
      let managerTasksQuery = supabase
        .from('tasks')
        .select('status')
        .like('description', `%CRM Task Ref: ${task.id}%`);
      if (rid) managerTasksQuery = managerTasksQuery.eq('restaurant_id', rid);
      const { data: managerTasks } = await managerTasksQuery;
      
      if (managerTasks && managerTasks.length > 0) {
        const managerStatus = managerTasks[0].status;
        const mappedStatus: 'Pending' | 'Completed' = managerStatus === 'Completed' ? 'Completed' : 'Pending';
        if (task.status !== mappedStatus) {
          await supabase.from('client_order_tasks').update({ status: mappedStatus }).eq('id', task.id);
          task.status = mappedStatus;
        }
      }
    }

    return {
      success: true,
      data: {
        order: orderWithClient,
        items: itemsRes.data || [],
        tasks: fetchedTasks,
        attachments: attachmentsData
      }
    };
  },

  saveClientOrder: async (order: any, items: any[], tasks: any[] = [], attachments: any[] = []) => {
    const orderPayload = await injectRestaurantId({ ...order });
    const { error: orderError } = await supabase.from('client_orders').upsert(orderPayload);
    if (orderError) return { success: false, error: orderError.message };

    if (order.id) await supabase.from('client_order_items').delete().eq('order_id', order.id);
    if (items.length > 0) {
      const itemsPayload = items.map((item: any) => ({
        ...item,
        order_id: order.id,
        customizations_json: item.customizations_json || [],
        customization_ids: item.customization_ids || []
      }));
      const { error: itemsError } = await supabase.from('client_order_items').insert(itemsPayload);
      if (itemsError) return { success: false, error: itemsError.message };
    }

    if (order.id) await supabase.from('client_order_attachments').delete().eq('order_id', order.id);
    if (attachments.length > 0) {
      const attachmentsPayload = attachments.map((att: any) => ({ ...att, order_id: order.id }));
      const { error: attachmentsError } = await supabase.from('client_order_attachments').insert(attachmentsPayload);
      if (attachmentsError) return { success: false, error: attachmentsError.message };
    }

    const { data: existingTasks } = await supabase.from('client_order_tasks').select('*').eq('order_id', order.id);
    const existingTasksList = existingTasks || [];

    const deletedTasks = existingTasksList.filter((et: any) => !tasks.some((t: any) => t.id === et.id));
    for (const dt of deletedTasks) {
      await supabase.from('tasks').delete().like('description', `%CRM Task Ref: ${dt.id}%`);
      await supabase.from('client_order_tasks').delete().eq('id', dt.id);
    }

    let clientName = 'Unknown';
    if (order.client_id) {
      const { data: cData } = await supabase.from('clients').select('name').eq('id', order.client_id).single();
      if (cData) clientName = (cData as any).name;
    }

    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    for (const task of tasks) {
      const isNew = !task.id || (typeof task.id === 'string' && !task.id.includes('-'));
      const taskId = isNew ? generateUUID() : task.id;

      const crmTaskPayload = {
        id: taskId,
        order_id: order.id,
        task_name: task.task_name,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        status: task.status || 'Pending'
      };

      const { error: crmTaskErr } = await supabase.from('client_order_tasks').upsert(crmTaskPayload);
      if (crmTaskErr) return { success: false, error: crmTaskErr.message };

      const { data: existingManagerTasks } = await supabase
        .from('tasks')
        .select('*')
        .like('description', `%CRM Task Ref: ${taskId}%`);

      const managerTaskPayload = {
        title: `[CRM Order: ${order.id}] ${task.task_name}`,
        description: `CRM Task Ref: ${taskId}\nOrder Category: ${order.category || 'Other'}\nClient: ${clientName}`,
        branch: order.branch,
        department: 'Floor',
        assigned_to_type: 'Employee',
        assigned_to: task.assigned_to,
        due_date: new Date(task.due_date).toISOString(),
        status: task.status || 'Pending'
      };

      if (existingManagerTasks && existingManagerTasks.length > 0) {
        const managerTaskId = (existingManagerTasks[0] as any).task_id;
        await supabase.from('tasks').update(managerTaskPayload).eq('task_id', managerTaskId);
      } else {
        const newManagerTask = { ...managerTaskPayload, created_by: order.salesperson || 'System', priority: 'Normal' };
        await supabase.from('tasks').insert([newManagerTask]);
      }
    }

    return { success: true };
  },

  deleteClientOrder: async (id: string) => {
    const { data: tasksToDelete } = await supabase.from('client_order_tasks').select('id').eq('order_id', id);
    if (tasksToDelete && tasksToDelete.length > 0) {
      for (const t of tasksToDelete) {
        await supabase.from('tasks').delete().like('description', `%CRM Task Ref: ${(t as any).id}%`);
      }
    }

    const { error } = await supabase.from('client_orders').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  updateClientOrderTaskStatus: async (taskId: string, status: 'Pending' | 'Completed') => {
    const { error: crmErr } = await supabase.from('client_order_tasks').update({ status }).eq('id', taskId);
    if (crmErr) return { success: false, error: crmErr.message };

    const { error: mrgErr } = await supabase.from('tasks').update({ status }).like('description', `%CRM Task Ref: ${taskId}%`);
    if (mrgErr) {
      console.warn('Failed to sync task status to Manager To-Do:', mrgErr.message);
    }
    
    return { success: true };
  },

  uploadClientOrderAttachment: async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const bucket = 'client-order-attachments';
      const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (error) return { success: false, error: error.message };
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return { success: true, url: publicUrlData.publicUrl, fileName: file.name };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // WhatsApp / Notifications placeholder
  whatsapp: {
    sendMessage: async (_to: string, _message: string) => {
      return { success: false, error: 'WhatsApp not configured' };
    }
  },

  // ── Reel Credit Transactions ──

  /**
   * Fetch reel_credit_transactions and group totals into shift buckets.
   *
   * Simple approach:
   *  1. Fetch all transactions in [startDate-1, endDate+1] (extra day for midnight-crossing).
   *  2. Build a day+branch total map.
   *  3. For each shift_cash submitted row, find the matching daily total using
   *     fuzzy branch-name matching (reel branch_name may differ from shift_cash branch).
   *  4. If shift defs exist → split by transaction_time; else whole-day total → first shift.
   *
   * Returns Record<`${shiftDate}||${shiftBranch}||${shiftName}`, totalUSD>
   * Keys match exactly what FinanceDashboardScreen uses for lookup.
   */
  getReelCreditByShifts: async (
    shiftRows: Array<{ branch: string; date: string; shift: string; created_at: string; rate?: number }>,
    startDate: string,
    endDate: string,
    _branch: string,
    shiftDefs?: Array<{ branch: string; shift_name: string; start_time: string; end_time: string }>
  ): Promise<{ success: boolean; data?: Record<string, number>; error?: string }> => {

    const addDays = (d: string, n: number) => {
      const dt = new Date(d + 'T12:00:00Z');
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };

    const toUsd = (amount: number, currency: string, rate: number): number => {
      if (!currency || currency.toLowerCase().includes('dollar') || currency.toUpperCase() === 'USD') return amount;
      return amount / rate; // LBP → USD
    };

    // ── 1. Fetch transactions ──
    const fetchFrom = addDays(startDate, -1);
    const fetchTo   = addDays(endDate, 1);
    let q = supabase
      .from('reel_credit_transactions')
      .select('branch_name, transaction_date, transaction_time, amount, currency')
      .gte('transaction_date', fetchFrom)
      .lte('transaction_date', fetchTo);
    // NOTE: do NOT filter by branch_name here — branch names may differ between systems.
    // We'll match fuzzy below.
    const { data: txns, error } = await q;
    if (error) return { success: false, error: error.message };
    if (!txns || txns.length === 0) return { success: true, data: {} };

    // ── 2. Build defMap: `${branchLower}||${shiftNameUpper}` → { start, end, crossesMidnight } ──
    const defMap: Record<string, { start: string; end: string; crossesMidnight: boolean }> = {};
    (shiftDefs ?? []).forEach(sd => {
      const key = `${(sd.branch ?? '').trim().toLowerCase()}||${(sd.shift_name ?? '').trim().toUpperCase()}`;
      defMap[key] = {
        start: sd.start_time,
        end:   sd.end_time,
        crossesMidnight: sd.end_time < sd.start_time,
      };
    });

    // ── 3. Build txsByDate: `${transaction_date}||${branch_name_lower}` → tx[] ──
    const txsByDate: Record<string, Array<{ time: string; amount: number; currency: string }>> = {};
    txns.forEach(t => {
      const key = `${t.transaction_date}||${(t.branch_name as string ?? '').trim().toLowerCase()}`;
      if (!txsByDate[key]) txsByDate[key] = [];
      txsByDate[key].push({
        time:     (t.transaction_time as string) ?? '00:00:00',
        amount:   Number(t.amount) || 0,
        currency: t.currency as string ?? '',
      });
    });

    // ── 4. Get all unique reel branch names for fuzzy matching ──
    const reelBranchNames = [...new Set(txns.map(t => (t.branch_name as string ?? '').trim().toLowerCase()))];

    // ── 5. Build submitted shifts map: `${date}||${branchLower}` → { [shiftName]: row } ──
    const submittedMap: Record<string, Record<string, any>> = {};
    shiftRows.forEach(s => {
      const dateStr = s.date.split('T')[0];
      const bLow = (s.branch ?? '').trim().toLowerCase();
      const k = `${dateStr}||${bLow}`;
      if (!submittedMap[k]) submittedMap[k] = {};
      submittedMap[k][s.shift] = s;
    });

    // ── 6. For each submitted date+branch, find matching reel branch and tally ──
    const result: Record<string, number> = {};

    Object.keys(submittedMap).forEach(smKey => {
      const [bizDate, shiftBranchLow] = smKey.split('||');
      const shifts = submittedMap[smKey];
      const rate = Object.values(shifts).reduce((r: number, s: any) => Number(s.rate) || r, 90000);
      const origBranch = Object.values(shifts)[0]?.branch ?? shiftBranchLow;

      // Find the reel branch whose name best matches (contains either direction)
      const matchedReelBranch = reelBranchNames.find(rb =>
        rb.includes(shiftBranchLow) || shiftBranchLow.includes(rb)
      ) ?? null;

      if (!matchedReelBranch) {
        // No reel data for this branch at all — skip silently
        return;
      }

      // Also check day before (for midnight-crossing PM transactions)
      const txKey      = `${bizDate}||${matchedReelBranch}`;
      const txKeyPrev  = `${addDays(bizDate, -1)}||${matchedReelBranch}`;
      const txKeyNext  = `${addDays(bizDate, 1)}||${matchedReelBranch}`;

      const txSameDay  = txsByDate[txKey]     ?? [];
      const txPrevDay  = txsByDate[txKeyPrev] ?? [];
      const txNextDay  = txsByDate[txKeyNext] ?? [];

      const shiftNames = Object.keys(shifts).sort(); // e.g. ["AM", "PM"]

      if (shiftNames.length === 0) return;

      if (Object.keys(defMap).length === 0 || !defMap[`${shiftBranchLow}||${shiftNames[0].toUpperCase()}`]) {
        // ── Fallback: no shift defs — put the whole day's total into the first (only) submitted shift ──
        const total = [...txSameDay, ...txPrevDay, ...txNextDay].reduce((s, tx) => s + toUsd(tx.amount, tx.currency, rate), 0);
        const firstShift = shiftNames[0];
        const key = `${bizDate}||${origBranch}||${firstShift}`;
        result[key] = (result[key] ?? 0) + total;
        return;
      }

      // ── With shift defs: split by dynamic submission-time windows ──
      //
      // Business rules:
      //   • Single shift only → full day: [def.start_time … 06:59:59 next day]
      //     (covers "AM submitted but PM not yet" and true single-shift branches)
      //   • First shift  → window: [def.start_time … firstShift.submitted_at]
      //   • Each next shift → window: (prevShift.submitted_at … thisShift.def.end_time]
      //     (the branch_shifts.start_time for non-first shifts is display-only)

      // Helper: ISO timestamp → "HH:MM:SS" in the browser's local timezone
      const isoToLocalTime = (iso: string) => {
        const d = new Date(iso);
        return [
          String(d.getHours()).padStart(2, '0'),
          String(d.getMinutes()).padStart(2, '0'),
          String(d.getSeconds()).padStart(2, '0'),
        ].join(':');
      };

      // Sort submitted shifts chronologically by their actual submission timestamp
      const shiftsSorted = Object.keys(shifts)
        .map(sn => ({ sn, row: shifts[sn] }))
        .sort((a, b) => new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime());

      // Build window boundaries for each shift
      type Window = { sn: string; startTime: string; endTime: string; startDate: string; endDate: string };
      const windows: Window[] = shiftsSorted.map((s, idx) => {
        const defKey = `${shiftBranchLow}||${s.sn.toUpperCase()}`;
        const def = defMap[defKey];

        // ── Special case: only 1 shift submitted for the whole day ──
        // Treat as full-day: [start_time → 06:59:59 next morning]
        if (shiftsSorted.length === 1) {
          return {
            sn:        s.sn,
            startTime: def?.start ?? '07:00:00',
            startDate: bizDate,
            endTime:   '06:59:59',
            endDate:   addDays(bizDate, 1),
          };
        }

        // Window start:
        //   - First shift → configured def.start_time
        //   - Subsequent shifts → previous shift's submission time + 1 second
        let windowStartTime: string;
        let windowStartDate: string;
        if (idx === 0) {
          windowStartTime = def?.start ?? '07:00:00';
          windowStartDate = bizDate;
        } else {
          const prevSubmitted = isoToLocalTime(shiftsSorted[idx - 1].row.created_at);
          const prevMs = new Date(`${bizDate}T${prevSubmitted}`).getTime() + 1000;
          const prevPlusOne = new Date(prevMs);
          windowStartTime = [
            String(prevPlusOne.getHours()).padStart(2, '0'),
            String(prevPlusOne.getMinutes()).padStart(2, '0'),
            String(prevPlusOne.getSeconds()).padStart(2, '0'),
          ].join(':');
          windowStartDate = bizDate;
        }

        // Window end:
        //   - Non-last shifts → cap at this shift's submission time (same day)
        //   - Last shift → use configured def.end_time (may cross midnight)
        let effectiveEndTime: string;
        let effectiveEndDate: string;
        if (idx < shiftsSorted.length - 1) {
          // Not the last shift — end at this shift's own submission time
          effectiveEndTime = isoToLocalTime(s.row.created_at);
          effectiveEndDate = bizDate;
        } else {
          // Last shift — run to configured end (crosses midnight if end < start)
          effectiveEndTime = def?.end ?? '06:59:59';
          const crossesMidnight = def ? (def.end < def.start) : true;
          effectiveEndDate = crossesMidnight ? addDays(bizDate, 1) : bizDate;
        }

        return {
          sn: s.sn,
          startTime: windowStartTime,
          startDate: windowStartDate,
          endTime:   effectiveEndTime,
          endDate:   effectiveEndDate,
        };
      });

      const allTx = [
        ...txSameDay.map(tx => ({ ...tx, txDate: bizDate })),
        ...txNextDay.map(tx => ({ ...tx, txDate: addDays(bizDate, 1) })),
        ...txPrevDay.map(tx => ({ ...tx, txDate: addDays(bizDate, -1) })),
      ];

      allTx.forEach(tx => {
        for (const win of windows) {
          const inWindow =
            tx.txDate >= win.startDate && tx.txDate <= win.endDate &&
            (tx.txDate > win.startDate || tx.time >= win.startTime) &&
            (tx.txDate < win.endDate  || tx.time <= win.endTime);

          if (inWindow) {
            const key = `${bizDate}||${origBranch}||${win.sn}`;
            result[key] = (result[key] ?? 0) + toUsd(tx.amount, tx.currency, rate);
            break;
          }
        }
      });
    });

    return { success: true, data: result };
  },

  getReelCreditRecords: async (filters?: { startDate?: string; endDate?: string; branch?: string; currency?: string }) => {
    let q = supabase
      .from('reel_credit_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('transaction_time', { ascending: false });
    if (filters?.startDate) q = q.gte('transaction_date', filters.startDate);
    if (filters?.endDate) q = q.lte('transaction_date', filters.endDate);
    if (filters?.branch && filters.branch !== 'All') q = q.eq('branch_name', filters.branch);
    if (filters?.currency && filters.currency !== 'All') q = q.eq('currency', filters.currency);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveReelCreditRecords: async (records: any[]) => {
    // Upsert on external_id — existing rows are silently skipped (ignoreDuplicates).
    // Supabase only returns rows that were actually inserted, so we can compute the
    // duplicate count as: submitted - inserted.
    const { data, error } = await supabase
      .from('reel_credit_transactions')
      .upsert(records, { onConflict: 'external_id', ignoreDuplicates: true })
      .select('id');
    if (error) return { success: false, error: error.message };
    const inserted = data?.length ?? 0;
    const duplicates = records.length - inserted;
    return { success: true, inserted, duplicates };
  },

  deleteReelCreditRecord: async (id: string) => {
    const { error } = await supabase.from('reel_credit_transactions').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getRestaurantsList: async () => {
    const { data, error } = await supabase.from('restaurants').select('*').order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getRestaurantById: async (id: string) => {
    const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  updateRestaurantSettings: async (id: string, settings: any) => {
    const { data, error } = await supabase
      .from('restaurants')
      .update({ settings })
      .eq('id', id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getTenantAdmin: async (restaurantId: string) => {
    // Use the get_tenant_admin RPC which correctly identifies the primary login account
    // by joining public.users with auth.users (oldest auth-confirmed admin first)
    const { data, error } = await supabase.rpc('get_tenant_admin', {
      p_restaurant_id: restaurantId
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.[0] || null };
  },

  updateRestaurantDetails: async (id: string, payload: {
    name: string;
    logo_url: string;
    primary_color: string;
    admin_id?: string;
    admin_name?: string;
    admin_email?: string;
    admin_pin?: string;
    admin_password?: string;
  }) => {
    const { error: restoErr } = await supabase
      .from('restaurants')
      .update({
        name: payload.name,
        logo_url: payload.logo_url,
        primary_color: payload.primary_color
      })
      .eq('id', id);

    if (restoErr) return { success: false, error: restoErr.message };

    if (payload.admin_email || payload.admin_name || payload.admin_pin || payload.admin_password) {
      const { error: rpcErr } = await supabase.rpc('update_tenant_admin_credentials', {
        p_restaurant_id: id,
        p_admin_id: payload.admin_id || null,
        p_admin_name: payload.admin_name || null,
        p_admin_email: payload.admin_email ? payload.admin_email.toLowerCase() : null,
        p_admin_pin: payload.admin_pin || null,
        p_admin_password: payload.admin_password || null
      });

      if (rpcErr) return { success: false, error: rpcErr.message };
    }

    return { success: true };
  },

  createTenantAdmin: async (payload: {
    r_name: string;
    r_logo: string;
    r_color: string;
    u_name: string;
    u_email: string;
    u_password: string;
    u_pin: string;
  }) => {
    const { data, error } = await supabase.rpc('create_tenant_admin', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  importTableData: async (tableName: string, rows: any[]) => {
    const { data, error } = await supabase.from(tableName).insert(rows);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getTableData: async (tableName: string, restaurantId: string) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },


  deleteRestaurant: async (restaurantId: string) => {
    const tables = [
      'users',
      'branches',
      'employees',
      'items',
      'menu_recipes',
      'waste_logs',
      'shift_cash',
      'daily_payments',
      'tips_collections',
      'chef_specials',
      'menu_86',
      'ClientComplaints',
      'client_orders',
      'void_receipts',
      'activity_logs',
      'reel_credit_transactions',
      'training_documents',
      'inventory_locations'
    ];

    for (const t of tables) {
      try {
        await supabase.from(t).delete().eq('restaurant_id', restaurantId);
      } catch (e) {
        // ignore errors for missing columns or tables
      }
    }

    const { error } = await supabase.from('restaurants').delete().eq('id', restaurantId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  sendDeletionApprovalEmail: async (restaurantId: string, restaurantName: string) => {
    let targetEmail = '';
    try {
      const { data } = await supabase
        .from('users')
        .select('email')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (data && data.length > 0 && data[0].email) {
        targetEmail = data[0].email;
      }

      await supabase.from('activity_logs').insert([{
        user_name: 'SuperAdmin',
        action: 'DELETION_APPROVAL_REQUESTED',
        details: `Approval notification requested for deletion of restaurant: ${restaurantName} (${restaurantId}). Target Email: ${targetEmail || 'N/A'}`
      }]);
    } catch (e) {
      // ignore log error
    }
    return { success: true, email: targetEmail };
  },

  getInventoryLocationsList: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_locations').select('*');
    if (rid) {
      query = query.or(`restaurant_id.eq.${rid},restaurant_id.is.null`);
    }
    const { data, error } = await query.order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveInventoryLocation: async (location: { id?: string, name: string, department?: string }) => {
    const locNameClean = location.name.trim();
    const locDeptClean = (location.department || 'Kitchen').trim();

    if (!location.id) {
      const { data: existing } = await supabase
        .from('inventory_locations')
        .select('id, name, department')
        .ilike('name', locNameClean)
        .ilike('department', locDeptClean)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `A storage location named "${locNameClean}" already exists in the ${locDeptClean} department.`
        };
      }
    }

    const payload = await injectRestaurantId({
      ...location,
      name: locNameClean,
      department: locDeptClean
    });

    const { error } = await supabase.from('inventory_locations').insert(payload);
    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint') || error.code === '23505') {
        return { 
          success: false, 
          error: `A storage location named "${locNameClean}" already exists in the ${locDeptClean} department.` 
        };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  deleteInventoryLocation: async (id: string) => {
    const { error } = await supabase.from('inventory_locations').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getWallets: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('e_wallets').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveWallet: async (wallet: any) => {
    const payload = await injectRestaurantId({ ...wallet });
    const { error } = await supabase.from('e_wallets').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteWallet: async (id: string) => {
    const { error } = await supabase.from('e_wallets').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getShiftCashWallets: async (shiftCashId: string) => {
    const { data, error } = await supabase
      .from('shift_cash_wallets')
      .select('*, e_wallets(*)')
      .eq('shift_cash_id', shiftCashId);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveShiftCashWallets: async (wallets: any[]) => {
    const { error } = await supabase.from('shift_cash_wallets').upsert(wallets);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getShiftCashWalletsLogs: async (filters: { startDate?: string, endDate?: string, branch?: string }) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('shift_cash_wallets')
      .select('*, shift_cash!inner(*), e_wallets(*)');
    if (rid) {
      query = query.eq('shift_cash.restaurant_id', rid);
    }
    if (filters.branch && filters.branch !== 'All') {
      query = query.ilike('shift_cash.branch', `%${filters.branch.trim()}%`);
    }
    if (filters.startDate) {
      const start = filters.startDate.split('T')[0].split(' ')[0];
      query = query.gte('shift_cash.date', start);
    }
    if (filters.endDate) {
      const endClean = filters.endDate.split('T')[0].split(' ')[0];
      const parts = endClean.split('-');
      if (parts.length === 3) {
        const nextDayStr = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + 1)).toISOString().split('T')[0];
        query = query.lt('shift_cash.date', nextDayStr);
      } else {
        query = query.lte('shift_cash.date', `${endClean} 23:59:59`);
      }
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getAttendanceLogs: async (filters: { employee_id?: string; branch?: string; startDate?: string; endDate?: string }) => {
    const rid = getRestaurantId();
    let query = supabase.from('employee_attendance').select('*, employees(*)');
    if (filters.employee_id && filters.employee_id !== 'All') query = query.eq('employee_id', filters.employee_id);
    if (filters.branch && filters.branch !== 'All') query = query.eq('branch', filters.branch);
    if (filters.startDate) query = query.gte('punch_in', filters.startDate);
    if (filters.endDate) query = query.lte('punch_in', filters.endDate);
    if (rid) query = query.eq('restaurant_id', rid);
    
    const { data, error } = await query.order('punch_in', { ascending: false });
    if (error) return { success: false, error: error.message };
    const filteredData = (data || []).filter((item: any) => {
      const emp = item.employees;
      if (!emp) return true;
      const status = (emp.status || '').toString().trim().toLowerCase();
      if (status === 'inactive' || status === 'disabled' || status === 'archived' || status === 'terminated') return false;
      if (emp.is_active === false || emp.is_active === 0 || emp.is_active === 'false') return false;
      if (emp.active === false || emp.active === 0 || emp.active === 'false') return false;
      return true;
    });
    return { success: true, data: filteredData };
  },

  saveAttendanceLog: async (log: any) => {
    const payload = { ...log };
    delete payload.date;
    delete payload.employees;
    delete payload.employee;

    const rid = getRestaurantId();
    if (!payload.restaurant_id && rid) {
      payload.restaurant_id = rid;
    }
    if (!payload.device_id) {
      payload.device_id = 'Web Admin / GPS Punch';
    }
    if (!payload.id) {
      delete payload.id;
    }

    let res;
    if (payload.id) {
      res = await supabase.from('employee_attendance').update(payload).eq('id', payload.id);
    } else {
      res = await supabase.from('employee_attendance').insert([payload]);
    }
    if (res.error) return { success: false, error: res.error.message };

    // Dispatch Punch In / Punch Out Notifications to Managers
    try {
      const globalRes = await api.getGlobalNotificationSettings();
      let shouldSend = true;
      if (globalRes.success && globalRes.data) {
        try {
          const val = typeof globalRes.data.setting_value === 'string'
            ? JSON.parse(globalRes.data.setting_value)
            : globalRes.data.setting_value;
          if (val && val.attendance_punch === false) {
            shouldSend = false;
          }
        } catch {}
      }

      if (shouldSend) {
        let empName = 'Employee';
        let branchName = payload.branch || 'Branch';
        if (payload.employee_id) {
          const { data: empData } = await supabase
            .from('employees')
            .select('first_name, last_name, branch')
            .eq('employee_id', payload.employee_id)
            .maybeSingle();
          if (empData) {
            empName = `${empData.first_name || ''} ${empData.last_name || ''}`.trim() || empName;
            if (!payload.branch && empData.branch) branchName = empData.branch;
          }
        }

        const isPunchOut = !!payload.punch_out;
        const punchTimeStr = (isPunchOut ? payload.punch_out : payload.punch_in)
          ? new Date(isPunchOut ? payload.punch_out : payload.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const title = isPunchOut
          ? `🔴 Clock-Out: ${empName}`
          : `🟢 Clock-In: ${empName}`;
        const message = isPunchOut
          ? `${empName} clocked OUT at ${branchName} (${punchTimeStr}).`
          : `${empName} clocked IN at ${branchName} (${punchTimeStr}).`;
        const notifType = isPunchOut ? 'punch_out' : 'punch_in';

        let managerQuery = supabase
          .from('employees')
          .select('employee_id, first_name, last_name, role, branch')
          .in('role', ['Manager', 'Admin', 'SuperAdmin', 'General Manager', 'Branch Manager', 'Owner']);
        if (payload.restaurant_id || rid) {
          managerQuery = managerQuery.eq('restaurant_id', payload.restaurant_id || rid);
        }
        const { data: managers } = await managerQuery;

        if (managers && managers.length > 0) {
          const targetManagers = managers.filter(m => 
            !m.branch || m.branch === 'All' || m.branch === branchName || ['Admin', 'SuperAdmin', 'Owner'].includes(m.role)
          );

          if (targetManagers.length > 0) {
            const notifications = await Promise.all(
              targetManagers.map((m) =>
                injectRestaurantId({
                  title,
                  message,
                  type: notifType,
                  target_user_id: m.employee_id,
                  is_read: false,
                  created_at: new Date().toISOString()
                })
              )
            );
            await supabase.from('notifications').insert(notifications);
          }
        }
      }
    } catch (notifErr) {
      console.error('Error dispatching punch notification to managers:', notifErr);
    }

    return { success: true };
  },

  deleteAttendanceLog: async (id: string) => {
    const { error } = await supabase.from('employee_attendance').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  resetEmployeeDevice: async (employeeId: string) => {
    const { error } = await supabase.from('employees').update({ device_id: null }).eq('employee_id', employeeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getEmployeeByUserId: async (userId: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('employees')
      .select('*')
      .eq('app_user_id', userId);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getActivePunchLog: async (employeeId: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('employee_attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .is('punch_out', null);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Inventory Management API Functions
  getStockBalances: async (branch?: string, location?: string) => {
    const rid = getRestaurantId();
    const [balRes, branchesRes, locsRes] = await Promise.all([
      rid
        ? supabase.from('inventory_stock_balances').select('*').eq('restaurant_id', rid).order('item_name')
        : supabase.from('inventory_stock_balances').select('*').order('item_name'),
      supabase.from('branches').select('id, name'),
      supabase.from('inventory_locations').select('id, name')
    ]);
    if (balRes.error) return { success: false, error: balRes.error.message };

    const branchMap = new Map((branchesRes.data || []).map((b: any) => [b.id, b.name]));
    const locMap = new Map((locsRes.data || []).map((l: any) => [l.id, l.name]));

    let rows = (balRes.data || []).map((row: any) => ({
      ...row,
      branch: row.branch || (row.branch_id ? branchMap.get(row.branch_id) : null) || 'Badaro',
      location: row.location || (row.location_id ? locMap.get(row.location_id) : null) || 'Main Kitchen',
    }));

    if (branch && branch !== 'All') {
      const bLower = branch.trim().toLowerCase();
      rows = rows.filter((r: any) =>
        (r.branch && r.branch.trim().toLowerCase() === bLower) ||
        r.branch_id === branch
      );
    }
    if (location && location !== 'All') {
      const lLower = location.trim().toLowerCase();
      rows = rows.filter((r: any) =>
        (r.location && r.location.trim().toLowerCase() === lLower) ||
        r.location_id === location
      );
    }

    return { success: true, data: rows };
  },

  upsertStockBalance: async (balance: any) => {
    const payload = await injectRestaurantId({ ...balance });
    const { error } = await supabase.from('inventory_stock_balances').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getStockCounts: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_counts').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getStockCountItems: async (countId: string) => {
    const { data, error } = await supabase
      .from('inventory_counts')
      .select('*')
      .eq('count_id', countId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveStockCount: async (header: any, items: any[]) => {
    const rid = getRestaurantId();
    const nowIso = new Date().toISOString();
    let branchId = header.branch_id;
    let locationId = header.location_id;
    const branchName = header.branch || 'Badaro';
    const locationName = header.location || 'Main Kitchen';

    const [bRes, lRes] = await Promise.all([
      supabase.from('branches').select('id, name').eq('restaurant_id', rid),
      supabase.from('inventory_locations').select('id, name, department').or(`restaurant_id.eq.${rid},restaurant_id.is.null`)
    ]);

    const matchedBranch = (bRes.data || []).find((b: any) =>
      b.id === branchId || b.name?.toLowerCase() === branchName.toLowerCase()
    ) || (bRes.data || [])[0];
    branchId = branchId || matchedBranch?.id;

    let matchedLoc = (lRes.data || []).find((l: any) =>
      l.id === locationId || l.name?.toLowerCase() === locationName.toLowerCase()
    );
    if (!matchedLoc && locationName) {
      const saveLocRes = await api.saveInventoryLocation({ name: locationName, department: 'Kitchen' });
      if (saveLocRes.success) {
        const { data: newLoc } = await supabase
          .from('inventory_locations')
          .select('id, name, department')
          .ilike('name', locationName.trim())
          .maybeSingle();
        matchedLoc = newLoc || undefined;
      }
    }
    if (!matchedLoc) matchedLoc = (lRes.data || [])[0];
    locationId = locationId || matchedLoc?.id;

    if (branchId && locationId) {
      // 1. Ensure baseline stock balance rows exist for all counted items so prepare_stock_count_sheet & reconciliation include every item
      const validItems = (items || []).filter((it: any) => it.item_id);
      if (validItems.length > 0) {
        const baselineBalances = validItems.map((it: any) => ({
          restaurant_id: rid,
          branch_id: branchId,
          branch: matchedBranch?.name || branchName,
          location_id: locationId,
          location: matchedLoc?.name || locationName,
          item_id: it.item_id,
          item_name: it.item_name || it.item || it.name,
          department: it.department || 'Kitchen',
          sub_department: it.sub_department || 'Other',
          unit: it.base_unit || it.unit || 'pcs',
          current_stock: 0,
          par_level: Number(it.par_level || 0),
          unit_cost: Number(it.unit_cost || 0),
        }));
        await supabase
          .from('inventory_stock_balances')
          .upsert(baselineBalances, { onConflict: 'restaurant_id,branch_id,location_id,item_id', ignoreDuplicates: true });
      }

      // 2. Prepare stock count sheet snapshot via canonical RPC
      const sheetRes = await supabase.rpc('prepare_stock_count_sheet', {
        p_branch_id: branchId,
        p_location_id: locationId,
        p_user_id: header.user_id || null,
        p_user_name: header.counted_by || header.user || 'Admin',
        p_as_of: header.inventory_as_of || nowIso
      });

      if (!sheetRes.error && sheetRes.data?.count_id) {
        const countId = sheetRes.data.count_id;
        // 3. Update item actual_count_qty AND count_qty for compatibility across Web Admin & Mobile
        for (const item of items) {
          if (item.item_id && item.count_qty !== undefined) {
            const qtyNum = Math.max(0, Number(item.count_qty || 0));
            await supabase
              .from('inventory_counts')
              .update({
                actual_count_qty: qtyNum,
                count_qty: qtyNum,
                par_level: Number(item.par_level || 0),
                notes: item.notes || header.notes || null,
                status: 'Completed',
                updated_at: nowIso,
              })
              .eq('count_id', countId)
              .eq('item_id', item.item_id);
          }
        }
        // 4. Reconcile count (default to true when status is Completed or auto_reconcile is set)
        if (header.auto_reconcile !== false) {
          await supabase.rpc('process_stock_count_reconciliation', {
            p_count_header_id: countId,
            p_user_id: header.user_id || null,
            p_user_name: header.counted_by || header.user || 'Admin'
          });
          await supabase
            .from('inventory_counts')
            .update({ status: 'Completed', updated_at: nowIso })
            .eq('count_id', countId);
        }
        return { success: true, id: countId };
      } else if (sheetRes.error) {
        return { success: false, error: sheetRes.error.message };
      }
    }

    return { success: false, error: 'Could not resolve canonical branch and location for stock count.' };
  },

  reconcileStockCount: async (countId: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('process_stock_count_reconciliation', {
      p_count_header_id: countId,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  updateStockCountQty: async (id: string, actualQty: number) => {
    const { error } = await supabase
      .from('inventory_counts')
      .update({ actual_count_qty: actualQty, count_qty: actualQty, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getStockAdjustments: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_adjustments').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveStockAdjustment: async (adjustment: any) => {
    const rid = getRestaurantId();
    const payload = await injectRestaurantId({ ...adjustment });
    const { data: adjRow, error } = await supabase.from('inventory_adjustments').insert([payload]).select('*').single();
    if (error) return { success: false, error: error.message };

    // Resolve branch_id, location_id, and item_id to keep inventory_stock_balances & inventory_movements in sync
    const [bRes, lRes, iRes] = await Promise.all([
      supabase.from('branches').select('id, name').eq('restaurant_id', rid),
      supabase.from('inventory_locations').select('id, name').or(`restaurant_id.eq.${rid},restaurant_id.is.null`),
      adjustment.item_id
        ? supabase.from('items').select('id, name, unit, base_unit, department, sub_department').eq('id', adjustment.item_id).maybeSingle()
        : supabase.from('items').select('id, name, unit, base_unit, department, sub_department').ilike('name', (adjustment.item_name || '').trim()).maybeSingle()
    ]);

    const matchedBranch = (bRes.data || []).find((b: any) => b.id === adjustment.branch_id || b.name?.toLowerCase() === (adjustment.branch || '').toLowerCase()) || (bRes.data || [])[0];
    const matchedLoc = (lRes.data || []).find((l: any) => l.id === adjustment.location_id || l.name?.toLowerCase() === (adjustment.location || '').toLowerCase()) || (lRes.data || [])[0];
    const matchedItem: any = iRes.data;

    const branchId = adjustment.branch_id || matchedBranch?.id;
    const locationId = adjustment.location_id || matchedLoc?.id;
    const itemId = adjustment.item_id || matchedItem?.id;

    if (itemId && branchId && locationId) {
      const isNegativeType = ['Waste/Damage', 'Expiry', 'Correction (-)'].includes(adjustment.adjustment_type);
      const rawQty = Math.abs(Number(adjustment.quantity || 0));
      const signedDelta = isNegativeType ? -rawQty : rawQty;
      const baseUnit = matchedItem?.base_unit || matchedItem?.unit || adjustment.unit || 'pcs';

      const { data: existingBal } = await supabase
        .from('inventory_stock_balances')
        .select('current_stock, unit_cost')
        .eq('restaurant_id', rid)
        .eq('branch_id', branchId)
        .eq('location_id', locationId)
        .eq('item_id', itemId)
        .maybeSingle();

      const nextStock = Number(existingBal?.current_stock || 0) + signedDelta;
      await supabase.from('inventory_stock_balances').upsert({
        restaurant_id: rid,
        branch_id: branchId,
        branch: matchedBranch?.name || adjustment.branch || 'Badaro',
        location_id: locationId,
        location: matchedLoc?.name || adjustment.location || 'Main Kitchen',
        item_id: itemId,
        item_name: matchedItem?.name || adjustment.item_name,
        department: matchedItem?.department || 'Kitchen',
        sub_department: matchedItem?.sub_department || null,
        unit: baseUnit,
        current_stock: nextStock,
        negative_stock: nextStock < 0,
        unit_cost: Number(adjustment.unit_cost || existingBal?.unit_cost || 0),
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'restaurant_id,branch_id,location_id,item_id' });

      await supabase.from('inventory_movements').insert([{
        restaurant_id: rid,
        branch_id: branchId,
        location_id: String(locationId),
        catalog_item_id: itemId,
        movement_type: 'STOCK_ADJUSTMENT',
        source_type: 'INVENTORY_ADJUSTMENT',
        source_id: String(adjRow?.id || Date.now()),
        source_line_id: String(adjRow?.id || Date.now()),
        quantity_delta: signedDelta,
        unit: baseUnit,
        unit_cost: Number(adjustment.unit_cost || existingBal?.unit_cost || 0),
        notes: `${adjustment.adjustment_type}: ${adjustment.reason || 'Manual adjustment'}`,
        created_by: adjustment.created_by || 'Admin',
      }]);
    }
    return { success: true };
  },

  getStockTransfers: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_transfers').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branch && branch !== 'All') {
      query = query.or(`from_branch.eq.${branch},to_branch.eq.${branch},from_branch_id.eq.${branch},to_branch_id.eq.${branch}`);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getStockTransferItems: async (transferId: string) => {
    const { data, error } = await supabase
      .from('inventory_transfer_items')
      .select('*')
      .eq('transfer_id', transferId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  createStockTransfer: async (header: any, items: any[]) => {
    const rid = getRestaurantId();
    const payloadHeader = await injectRestaurantId({
      ...header,
      transfer_number: header.transfer_number || `TRF-${Date.now().toString().slice(-6)}`,
      transfer_status: 'DRAFT',
      status: 'Draft'
    });

    const { data: trfRes, error: trfErr } = await supabase
      .from('inventory_transfers')
      .insert([payloadHeader])
      .select('id')
      .single();

    if (trfErr) return { success: false, error: trfErr.message };
    const transferId = trfRes.id;

    if (items && items.length > 0) {
      const payloadItems = items.map(item => ({
        transfer_id: transferId,
        restaurant_id: rid,
        item_id: item.item_id,
        item_name: item.item_name || item.name,
        quantity: Number(item.quantity || 0),
        unit: item.unit || 'pcs',
        unit_cost: Number(item.unit_cost || 0),
        dispatched_quantity: Number(item.quantity || 0),
        dispatched_unit: item.unit || 'pcs'
      }));
      const { error: itemErr } = await supabase.from('inventory_transfer_items').insert(payloadItems);
      if (itemErr) return { success: false, error: itemErr.message };
    }

    return { success: true, id: transferId };
  },

  dispatchStockTransfer: async (transferId: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('dispatch_stock_transfer', {
      p_transfer_id: transferId,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  receiveStockTransfer: async (transferId: string, receivedItems?: any[], userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('receive_stock_transfer', {
      p_transfer_id: transferId,
      p_received_items: receivedItems ? receivedItems : null,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  reverseStockTransfer: async (transferId: string, reason: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('reverse_stock_transfer', {
      p_transfer_id: transferId,
      p_reason: reason,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  saveStockTransfer: async (header: any, items: any[]) => {
    const rid = getRestaurantId();
    const enrichedHeader = { ...header };

    if (!enrichedHeader.from_branch_id || !enrichedHeader.to_branch_id || !enrichedHeader.from_location_id || !enrichedHeader.to_location_id) {
      const [bRes, lRes] = await Promise.all([
        supabase.from('branches').select('id, name').eq('restaurant_id', rid),
        supabase.from('inventory_locations').select('id, name').or(`restaurant_id.eq.${rid},restaurant_id.is.null`)
      ]);
      const branches = bRes.data || [];
      const locs = lRes.data || [];
      if (!enrichedHeader.from_branch_id && enrichedHeader.from_branch) {
        enrichedHeader.from_branch_id = branches.find((b: any) => b.name?.toLowerCase() === enrichedHeader.from_branch.toLowerCase())?.id || branches[0]?.id;
      }
      if (!enrichedHeader.to_branch_id && enrichedHeader.to_branch) {
        enrichedHeader.to_branch_id = branches.find((b: any) => b.name?.toLowerCase() === enrichedHeader.to_branch.toLowerCase())?.id || branches[0]?.id;
      }
      if (!enrichedHeader.from_location_id && enrichedHeader.from_location) {
        enrichedHeader.from_location_id = locs.find((l: any) => l.name?.toLowerCase() === enrichedHeader.from_location.toLowerCase())?.id;
      }
      if (!enrichedHeader.to_location_id && enrichedHeader.to_location) {
        enrichedHeader.to_location_id = locs.find((l: any) => l.name?.toLowerCase() === enrichedHeader.to_location.toLowerCase())?.id;
      }
      if (!enrichedHeader.transfer_type) {
        enrichedHeader.transfer_type = enrichedHeader.from_branch_id === enrichedHeader.to_branch_id ? 'INTERNAL' : 'INTER_BRANCH';
      }
    }

    // If canonical branch/location IDs exist, execute atomic dispatch via stored procedure
    if (enrichedHeader.from_branch_id && enrichedHeader.to_branch_id && enrichedHeader.from_location_id && enrichedHeader.to_location_id) {
      const createRes = await api.createStockTransfer(enrichedHeader, items);
      if (!createRes.success) return createRes;
      const dispatchRes = await api.dispatchStockTransfer(createRes.id, enrichedHeader.created_by_id, enrichedHeader.created_by);
      return dispatchRes;
    }

    // Legacy fallback
    const payloadHeader = await injectRestaurantId({
      ...enrichedHeader,
      transfer_number: enrichedHeader.transfer_number || `TRF-${Date.now().toString().slice(-6)}`
    });

    const { data: trfRes, error: trfErr } = await supabase
      .from('inventory_transfers')
      .insert([payloadHeader])
      .select('id')
      .single();

    if (trfErr) return { success: false, error: trfErr.message };
    return { success: true, id: trfRes.id };
  },

  // ----------------------------------------------------
  // PHASE 3: GOODS RECEIPT (GRN) METHODS
  // ----------------------------------------------------
  getGoodsReceipts: async (branchId?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('goods_receipts').select('*, suppliers(name), inventory_locations(name)');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branchId && branchId !== 'All') query = query.eq('branch_id', branchId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getGoodsReceiptItems: async (receiptId: string) => {
    const { data, error } = await supabase
      .from('goods_receipt_items')
      .select('*, items(name, base_unit)')
      .eq('receipt_id', receiptId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  createGoodsReceipt: async (header: any, items: any[]) => {
    const rid = getRestaurantId();
    const payloadHeader = await injectRestaurantId({
      ...header,
      receipt_number: header.receipt_number || `GRN-${Date.now().toString().slice(-6)}`,
      status: 'DRAFT'
    });
    const { data: recRes, error: recErr } = await supabase
      .from('goods_receipts')
      .insert([payloadHeader])
      .select('id')
      .single();
    if (recErr) return { success: false, error: recErr.message };
    const receiptId = recRes.id;

    if (items && items.length > 0) {
      const payloadItems = items.map(item => ({
        receipt_id: receiptId,
        item_id: item.item_id,
        purchase_quantity: Number(item.purchase_quantity || item.quantity || 0),
        purchase_unit: item.purchase_unit || item.unit || 'pcs',
        purchase_unit_cost: Number(item.purchase_unit_cost || item.unit_cost || 0),
        base_quantity: Number(item.base_quantity || item.quantity || 0),
        base_unit: item.base_unit || item.unit || 'pcs',
        base_unit_cost: Number(item.base_unit_cost || 0),
        total_cost: Number(item.total_cost || (Number(item.purchase_quantity || item.quantity || 0) * Number(item.purchase_unit_cost || item.unit_cost || 0))),
        notes: item.notes || null
      }));
      const { error: itemErr } = await supabase.from('goods_receipt_items').insert(payloadItems);
      if (itemErr) return { success: false, error: itemErr.message };
    }
    return { success: true, id: receiptId };
  },

  postGoodsReceipt: async (receiptId: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('process_goods_receipt', {
      p_receipt_id: receiptId,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  reverseGoodsReceipt: async (receiptId: string, reason: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('reverse_goods_receipt', {
      p_receipt_id: receiptId,
      p_reason: reason,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  // ----------------------------------------------------
  // PHASE 3: WASTE LOGGING METHOD
  // ----------------------------------------------------
  logStockWaste: async (payload: any, userId?: string, userName?: string) => {
    const rid = getRestaurantId();
    const wastePayload = await injectRestaurantId({
      ...payload,
      status: 'Logged',
      created_by: userName || 'Admin'
    });
    const { data: wRes, error: wErr } = await supabase
      .from('waste_logs')
      .insert([wastePayload])
      .select('id')
      .single();
    if (wErr) return { success: false, error: wErr.message };
    const wasteId = wRes.id;
    const { data, error } = await supabase.rpc('process_stock_waste', {
      p_waste_id: wasteId,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  // ----------------------------------------------------
  // PHASE 3: LEDGER & NEGATIVE STOCK EXPLORER
  // ----------------------------------------------------
  getItemMovementLedger: async (itemId: string, branchId?: string, locationId?: string) => {
    const { data, error } = await supabase.rpc('get_item_movement_ledger', {
      p_item_id: itemId,
      p_branch_id: branchId && branchId !== 'All' ? branchId : null,
      p_location_id: locationId && locationId !== 'All' ? locationId : null
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getNegativeStockExceptions: async (branchId?: string) => {
    const { data, error } = await supabase.rpc('get_negative_stock_exceptions', {
      p_branch_id: branchId && branchId !== 'All' ? branchId : null
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  // ----------------------------------------------------
  // PHASE 4: PRODUCTION & BATCH MANAGEMENT METHODS
  // ----------------------------------------------------
  getProductionRecipeCatalog: async () => {
    const rid = getRestaurantId();
    let query = supabase
      .from('production_recipes')
      .select(`
        *,
        output_item:items!output_item_id(id, name, unit, base_unit, price_usd, department),
        production_recipe_items(
          *,
          items:item_id(id, name, unit, base_unit, price_usd, department)
        )
      `)
      .order('name');
    if (rid) query = query.eq('restaurant_id', rid);

    const { data, error } = await query;
    if (error) {
      let simpleQuery = supabase
        .from('production_recipes')
        .select('*, production_recipe_items(*)')
        .order('name');
      if (rid) simpleQuery = simpleQuery.eq('restaurant_id', rid);
      const simpleRes = await simpleQuery;
      if (simpleRes.error) return { success: false, error: simpleRes.error.message };
      return { success: true, data: simpleRes.data || [] };
    }
    return { success: true, data: data || [] };
  },

  getProductionRecipesList: async () => {
    return api.getProductionRecipeCatalog();
  },

  getProductionRecipeForEdit: async (id: string) => {
    const rid = getRestaurantId();
    if (!rid) return { success: false, error: 'Restaurant context required' };

    const { data: header, error: headerError } = await supabase
      .from('production_recipes')
      .select('*')
      .eq('restaurant_id', rid)
      .eq('id', id)
      .single();

    if (headerError || !header) {
      return { success: false, error: headerError?.message || 'Production recipe not found' };
    }

    const { data: items, error: itemsError } = await supabase
      .from('production_recipe_items')
      .select('*')
      .eq('production_recipe_id', id);

    if (itemsError) {
      return { success: false, error: itemsError.message };
    }

    return {
      success: true,
      data: {
        ...header,
        items: items || []
      }
    };
  },

  upsertProductionRecipe: async (params: {
    recipe_code: string;
    name: string;
    output_item_id: string;
    target_yield_quantity: number | string;
    yield_unit: string;
    default_location_id?: string | null;
    shelf_life_days?: number | string | null;
    prep_time_minutes?: number | string | null;
    instructions?: string | null;
    items?: Array<{
      item_id: string;
      quantity: number | string;
      unit: string;
      waste_percentage?: number | string;
      source_location_id?: string | null;
      notes?: string | null;
    }>;
    user_name?: string;
    existing_recipe_id?: string;
  }) => {
    const rid = getRestaurantId();
    if (!rid) return { success: false, error: 'Restaurant context required' };

    const { data: existing } = await supabase
      .from('production_recipes')
      .select('id')
      .eq('restaurant_id', rid)
      .eq('recipe_code', params.recipe_code)
      .maybeSingle();

    if (existing) {
      if (!params.existing_recipe_id || existing.id !== params.existing_recipe_id) {
        return { success: false, error: 'A recipe with this code already exists' };
      }
    }

    const { data, error } = await supabase.rpc('upsert_production_recipe', {
      p_restaurant_id: rid,
      p_recipe_code: params.recipe_code,
      p_name: params.name,
      p_output_item_id: params.output_item_id,
      p_target_yield_quantity: Number(params.target_yield_quantity),
      p_yield_unit: params.yield_unit,
      p_default_location_id: params.default_location_id || null,
      p_shelf_life_days: params.shelf_life_days !== undefined && params.shelf_life_days !== '' && params.shelf_life_days !== null ? Number(params.shelf_life_days) : null,
      p_prep_time_minutes: params.prep_time_minutes !== undefined && params.prep_time_minutes !== '' && params.prep_time_minutes !== null ? Number(params.prep_time_minutes) : null,
      p_instructions: params.instructions || null,
      p_items: (params.items || []).map(it => ({
        item_id: it.item_id,
        quantity: Number(it.quantity),
        unit: it.unit,
        waste_percentage: it.waste_percentage !== undefined && it.waste_percentage !== '' ? Number(it.waste_percentage) : 0,
        source_location_id: it.source_location_id || null,
        notes: it.notes || null
      })),
      p_user_name: params.user_name || 'Admin'
    });

    if (error) return { success: false, error: error.message };
    if (!data || data.success === false) return { success: false, error: data?.error || 'Failed to save production recipe' };
    return { success: true, ...data };
  },

  createProductionBatch: async (params: {
    recipe_id: string;
    branch_id: string;
    location_id: string;
    destination_location_id: string;
    planned_yield_quantity: number;
    planned_yield_unit: string;
    batch_date?: string;
    user_id?: string;
    user_name?: string;
    notes?: string;
  }) => {
    const rid = getRestaurantId();
    let resolvedBranchId = params.branch_id;
    if (!resolvedBranchId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedBranchId)) {
      const { data: bList } = await supabase.from('branches').select('id, name').eq('restaurant_id', rid);
      const match = (bList || []).find((b: any) => b.name?.trim().toLowerCase() === (resolvedBranchId || '').trim().toLowerCase());
      if (match) {
        resolvedBranchId = match.id;
      } else if (bList && bList.length > 0) {
        resolvedBranchId = bList[0].id;
      }
    }
    const { data, error } = await supabase.rpc('create_production_batch', {
      p_restaurant_id: rid,
      p_recipe_id: params.recipe_id,
      p_branch_id: resolvedBranchId,
      p_location_id: params.location_id,
      p_destination_location_id: params.destination_location_id,
      p_planned_yield_quantity: params.planned_yield_quantity,
      p_planned_yield_unit: params.planned_yield_unit,
      p_batch_date: params.batch_date || new Date().toISOString().split('T')[0],
      p_user_id: params.user_id || null,
      p_user_name: params.user_name || 'Admin',
      p_notes: params.notes || null
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  startProductionBatch: async (batchId: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('start_production_batch', {
      p_batch_id: batchId,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  completeProductionBatch: async (params: {
    batch_id: string;
    actual_yield_quantity: number;
    actual_yield_unit: string;
    actual_items?: Array<{
      item_id: string;
      actual_quantity: number;
      actual_unit?: string;
    }>;
    yield_variance_reason?: string;
    user_id?: string;
    user_name?: string;
  }) => {
    const { data, error } = await supabase.rpc('complete_production_batch', {
      p_batch_id: params.batch_id,
      p_actual_yield_quantity: params.actual_yield_quantity,
      p_actual_yield_unit: params.actual_yield_unit,
      p_actual_items: params.actual_items ? JSON.stringify(params.actual_items) : null,
      p_yield_variance_reason: params.yield_variance_reason || null,
      p_user_id: params.user_id || null,
      p_user_name: params.user_name || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  cancelProductionBatch: async (batchId: string, reason: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('cancel_production_batch', {
      p_batch_id: batchId,
      p_reason: reason,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  reverseCompletedProductionBatch: async (batchId: string, reason: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('reverse_completed_production_batch', {
      p_batch_id: batchId,
      p_reason: reason,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  getProductionBatches: async (filters?: {
    branch_id?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('production_batches')
      .select(`
        *,
        recipe:production_recipes!production_recipe_id(id, name, recipe_code),
        output_item:items!output_item_id(id, name, unit, base_unit),
        source_location:inventory_locations!location_id(id, name),
        destination_location:inventory_locations!destination_location_id(id, name),
        items:production_batch_items(*)
      `)
      .order('created_at', { ascending: false });

    if (rid) query = query.eq('restaurant_id', rid);
    if (filters?.branch_id && filters.branch_id !== 'All') query = query.eq('branch_id', filters.branch_id);
    if (filters?.status && filters.status !== 'All') query = query.eq('status', filters.status);
    if (filters?.startDate) query = query.gte('batch_date', filters.startDate);
    if (filters?.endDate) query = query.lte('batch_date', filters.endDate);

    const { data, error } = await query.limit(500);
    if (error) {
      let fallbackQuery = supabase
        .from('production_batches')
        .select('*, items:production_batch_items(*)')
        .order('created_at', { ascending: false });
      if (rid) fallbackQuery = fallbackQuery.eq('restaurant_id', rid);
      if (filters?.branch_id && filters.branch_id !== 'All') fallbackQuery = fallbackQuery.eq('branch_id', filters.branch_id);
      if (filters?.status && filters.status !== 'All') fallbackQuery = fallbackQuery.eq('status', filters.status);
      if (filters?.startDate) fallbackQuery = fallbackQuery.gte('batch_date', filters.startDate);
      if (filters?.endDate) fallbackQuery = fallbackQuery.lte('batch_date', filters.endDate);

      const fb = await fallbackQuery.limit(500);
      if (fb.error) return { success: false, error: fb.error.message };
      return { success: true, data: fb.data || [] };
    }
    return { success: true, data: data || [] };
  },

  getProductionBatchById: async (batchId: string) => {
    const { data, error } = await supabase
      .from('production_batches')
      .select(`
        *,
        recipe:production_recipes!production_recipe_id(*),
        output_item:items!output_item_id(id, name, unit, base_unit),
        source_location:inventory_locations!location_id(id, name),
        destination_location:inventory_locations!destination_location_id(id, name),
        items:production_batch_items(*)
      `)
      .eq('id', batchId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  dispatchStockTransferLots: async (transferId: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('dispatch_stock_transfer_lots', {
      p_transfer_id: transferId,
      p_user_id: userId || null,
      p_user_name: userName || 'Admin'
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  // ----------------------------------------------------
  // SHIFT MANAGEMENT API METHODS (Phase 1)
  // ----------------------------------------------------
  getShiftTemplates: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('shift_templates').select('*');
    if (branch && branch !== 'All') query = query.or(`branch.eq.${branch},branch.is.null`);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveShiftTemplate: async (template: any) => {
    const payload = await injectRestaurantId({ ...template, updated_at: new Date().toISOString() });
    if (!payload.id) delete payload.id;

    let res;
    if (template.id) {
      res = await supabase.from('shift_templates').update(payload).eq('id', template.id);
    } else {
      res = await supabase.from('shift_templates').insert([payload]);
    }
    if (res.error) return { success: false, error: res.error.message };
    return { success: true };
  },

  deleteShiftTemplate: async (id: string) => {
    const { error } = await supabase.from('shift_templates').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getEmployeeSchedules: async (filters: { startDate?: string; endDate?: string; branch?: string; employee_id?: string; status?: string }) => {
    const rid = getRestaurantId();
    let query = supabase.from('employee_schedules').select('*');
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.branch && filters.branch !== 'All') query = query.eq('branch', filters.branch);
    if (filters.employee_id && filters.employee_id !== 'All') query = query.eq('employee_id', filters.employee_id);
    if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: schedData, error } = await query.order('date', { ascending: true });
    if (error) return { success: false, error: error.message };

    let empQuery = supabase.from('employees').select('*');
    if (rid) empQuery = empQuery.eq('restaurant_id', rid);
    const { data: empData } = await empQuery;

    const empMap = new Map();
    (empData || []).forEach((e: any) => {
      if (e.employee_id) empMap.set(String(e.employee_id), e);
      if (e.id) empMap.set(String(e.id), e);
    });

    const merged = (schedData || []).map((s) => {
      const emp = empMap.get(String(s.employee_id)) || s.employees || null;
      const empName = emp ? (`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.full_name) : null;
      return {
        ...s,
        employees: emp,
        employee_name: empName || s.employee_name || null
      };
    }).filter((s) => {
      const emp = s.employees;
      if (!emp) return true;
      const status = (emp.status || '').toString().trim().toLowerCase();
      if (status === 'inactive' || status === 'disabled' || status === 'archived' || status === 'terminated') return false;
      if (emp.is_active === false || emp.is_active === 0 || emp.is_active === 'false') return false;
      if (emp.active === false || emp.active === 0 || emp.active === 'false') return false;
      return true;
    });

    return { success: true, data: merged };
  },

  saveEmployeeSchedule: async (schedule: any) => {
    const parseTimeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const payload = await injectRestaurantId({ ...schedule, updated_at: new Date().toISOString() });
    if (!payload.id) delete payload.id;

    // Validate Schedule Conflicts (Leave exclusivity & Non-overlapping shift rules)
    let query = supabase
      .from('employee_schedules')
      .select('*')
      .eq('employee_id', payload.employee_id)
      .eq('date', payload.date);

    if (payload.id) query = query.neq('id', payload.id);
    const { data: existingSchedules } = await query;

    if (existingSchedules && existingSchedules.length > 0) {
      // Rule 1: If assigning a Day Off / Leave, block if ANY assignment already exists on date
      if (payload.assignment_type !== 'shift') {
        const firstEx = existingSchedules[0];
        const exName = firstEx.shift_name || firstEx.assignment_type.replace('_', ' ').toUpperCase();
        return {
          success: false,
          error: `Schedule conflict on ${payload.date}! Employee already has "${exName}" assigned. Cannot assign Day Off/Leave on a date with existing shifts.`
        };
      }

      // Rule 2: If assigning a Work Shift, check existing assignments
      if (payload.assignment_type === 'shift') {
        for (const ex of existingSchedules) {
          // Rule 2a: If existing record is Day Off / Leave, block adding a shift
          if (ex.assignment_type !== 'shift') {
            const leaveName = ex.shift_name || ex.assignment_type.replace('_', ' ').toUpperCase();
            return {
              success: false,
              error: `Schedule conflict on ${payload.date}! Employee is on "${leaveName}". Cannot add a work shift on a day off or leave.`
            };
          }

          // Rule 2b: If existing record is a work shift, check time overlap
          if (ex.start_time && ex.end_time && payload.start_time && payload.end_time) {
            let startA = parseTimeToMinutes(ex.start_time);
            let endA = parseTimeToMinutes(ex.end_time);
            if (endA <= startA) endA += 1440; // Overnight shift

            let startB = parseTimeToMinutes(payload.start_time);
            let endB = parseTimeToMinutes(payload.end_time);
            if (endB <= startB) endB += 1440; // Overnight shift

            if (startB < endA && endB > startA) {
              return {
                success: false,
                error: `Shift overlap detected! Employee is already scheduled for "${ex.shift_name || 'Shift'}" (${ex.start_time} - ${ex.end_time}) on ${payload.date}. Non-overlapping shifts only (e.g. 07:00-12:00 and 17:00-22:00).`
              };
            }
          }
        }
      }
    }

    let res;
    if (schedule.id) {
      res = await supabase.from('employee_schedules').update(payload).eq('id', schedule.id);
    } else {
      res = await supabase.from('employee_schedules').insert([payload]);
    }
    if (res.error) return { success: false, error: res.error.message };

    // Send targeted schedule update notification to the specific employee
    try {
      const shiftDesc = payload.shift_name || (payload.assignment_type ? payload.assignment_type.replace('_', ' ').toUpperCase() : 'Shift');
      const notif = await injectRestaurantId({
        title: '📅 Schedule Updated',
        message: `Your work schedule for ${payload.date} (${shiftDesc}) has been updated. Please check your schedule for changes.`,
        type: 'schedule_updated',
        target_user_id: payload.employee_id,
        is_read: false,
        created_at: new Date().toISOString()
      });
      await supabase.from('notifications').insert([notif]);
    } catch (notifErr) {
      console.error('Error sending schedule update notification:', notifErr);
    }

    return { success: true };
  },

  saveEmployeeSchedulesBatch: async (schedules: any[]) => {
    if (!schedules.length) return { success: true, count: 0 };

    const parseTimeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const prepared = await Promise.all(
      schedules.map(async (s) => {
        const p = await injectRestaurantId({ ...s, updated_at: new Date().toISOString() });
        if (!p.id) delete p.id;
        return p;
      })
    );

    // Validate Schedule Conflicts across prepared batch items and database
    for (const p of prepared) {
      let query = supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', p.employee_id)
        .eq('date', p.date);

      if (p.id) query = query.neq('id', p.id);
      const { data: existingSchedules } = await query;

      if (existingSchedules && existingSchedules.length > 0) {
        if (p.assignment_type !== 'shift') {
          const firstEx = existingSchedules[0];
          const exName = firstEx.shift_name || firstEx.assignment_type.replace('_', ' ').toUpperCase();
          return {
            success: false,
            error: `Schedule conflict on ${p.date}! Employee already has "${exName}" assigned. Cannot assign Day Off/Leave on a date with existing shifts.`
          };
        }

        if (p.assignment_type === 'shift') {
          for (const ex of existingSchedules) {
            if (ex.assignment_type !== 'shift') {
              const leaveName = ex.shift_name || ex.assignment_type.replace('_', ' ').toUpperCase();
              return {
                success: false,
                error: `Schedule conflict on ${p.date}! Employee is on "${leaveName}". Cannot add a work shift on a day off or leave.`
              };
            }

            if (ex.start_time && ex.end_time && p.start_time && p.end_time) {
              let startA = parseTimeToMinutes(ex.start_time);
              let endA = parseTimeToMinutes(ex.end_time);
              if (endA <= startA) endA += 1440;

              let startB = parseTimeToMinutes(p.start_time);
              let endB = parseTimeToMinutes(p.end_time);
              if (endB <= startB) endB += 1440;

              if (startB < endA && endB > startA) {
                return {
                  success: false,
                  error: `Shift overlap detected for date ${p.date}! Existing shift "${ex.shift_name || 'Shift'}" (${ex.start_time} - ${ex.end_time}) overlaps with new shift (${p.start_time} - ${p.end_time}).`
                };
              }
            }
          }
        }
      }
    }

    const { data, error } = await supabase.from('employee_schedules').insert(prepared).select('id');
    if (error) return { success: false, error: error.message };

    // Send targeted update notifications to only the affected employees in batch
    try {
      const targetEmpIds = Array.from(new Set(prepared.map((p) => p.employee_id)));
      const notifications = await Promise.all(
        targetEmpIds.map((empId) =>
          injectRestaurantId({
            title: '📅 Schedule Updated',
            message: `Your work schedule has been updated. Please check your schedule for details.`,
            type: 'schedule_updated',
            target_user_id: empId,
            is_read: false,
            created_at: new Date().toISOString()
          })
        )
      );
      await supabase.from('notifications').insert(notifications);
    } catch (notifErr) {
      console.error('Error sending batch schedule update notifications:', notifErr);
    }

    return { success: true, count: data?.length || 0 };
  },

  deleteEmployeeSchedule: async (id: string) => {
    const { data: sched } = await supabase.from('employee_schedules').select('*').eq('id', id).single();
    const { error } = await supabase.from('employee_schedules').delete().eq('id', id);
    if (error) return { success: false, error: error.message };

    if (sched && sched.employee_id) {
      try {
        const notif = await injectRestaurantId({
          title: '📅 Schedule Updated',
          message: `Your shift on ${sched.date} (${sched.shift_name || 'Shift'}) has been updated / removed.`,
          type: 'schedule_updated',
          target_user_id: sched.employee_id,
          is_read: false,
          created_at: new Date().toISOString()
        });
        await supabase.from('notifications').insert([notif]);
      } catch (notifErr) {
        console.error('Error sending schedule deletion notification:', notifErr);
      }
    }

    return { success: true };
  },

  deleteDraftSchedules: async (startDate: string, endDate: string, branch?: string, employeeId?: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('employee_schedules')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'draft');

    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (employeeId && employeeId !== 'All') query = query.eq('employee_id', employeeId);
    if (rid) query = query.eq('restaurant_id', rid);

    const { error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deduplicateDraftSchedules: async (startDate: string, endDate: string, branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('employee_schedules')
      .select('id, employee_id, date, assignment_type, start_time, end_time, shift_name, status, created_at')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'draft');

    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: list, error } = await query;
    if (error) return { success: false, error: error.message };
    if (!list || list.length === 0) return { success: true, removedCount: 0 };

    // Group by unique key and collect duplicate IDs
    const seen = new Set<string>();
    const duplicateIds: string[] = [];

    const sorted = [...list].sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

    for (const item of sorted) {
      const key = `${item.employee_id}_${item.date}_${item.assignment_type}_${item.start_time || ''}_${item.end_time || ''}_${item.shift_name || ''}`;
      if (seen.has(key)) {
        duplicateIds.push(item.id);
      } else {
        seen.add(key);
      }
    }

    if (duplicateIds.length > 0) {
      for (let i = 0; i < duplicateIds.length; i += 50) {
        const chunk = duplicateIds.slice(i, i + 50);
        const { error: delErr } = await supabase
          .from('employee_schedules')
          .delete()
          .in('id', chunk);
        if (delErr) return { success: false, error: delErr.message };
      }
    }

    return { success: true, removedCount: duplicateIds.length };
  },

  copyPreviousWeekSchedule: async (
    sourceStartDate: string,
    targetStartDate: string,
    branch?: string,
    overwriteExistingDrafts: boolean = true
  ) => {
    const rid = getRestaurantId();

    const getMonday = (dStr: string): string => {
      const parts = dStr.split('-').map(Number);
      const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      const Y = date.getFullYear();
      const M = String(date.getMonth() + 1).padStart(2, '0');
      const D = String(date.getDate()).padStart(2, '0');
      return `${Y}-${M}-${D}`;
    };

    const addDays = (dStr: string, n: number): string => {
      const parts = dStr.split('-').map(Number);
      const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      date.setDate(date.getDate() + n);
      const Y = date.getFullYear();
      const M = String(date.getMonth() + 1).padStart(2, '0');
      const D = String(date.getDate()).padStart(2, '0');
      return `${Y}-${M}-${D}`;
    };

    const getDayIndex = (dStr: string): number => {
      const parts = dStr.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      const day = d.getDay();
      return day === 0 ? 6 : day - 1; // 0=Mon, 1=Tue, ..., 6=Sun
    };

    let srcMon = getMonday(sourceStartDate);
    let tgtMon = getMonday(targetStartDate);

    // If source and target resolve to the same Monday (e.g. user entered source 07/09 and target 13/09):
    if (srcMon === tgtMon) {
      tgtMon = addDays(srcMon, 7);
    }

    const srcSunday = addDays(srcMon, 6);
    const tgtSunday = addDays(tgtMon, 6);

    let query = supabase
      .from('employee_schedules')
      .select('*')
      .gte('date', srcMon)
      .lte('date', srcSunday);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: existingSource, error: fetchErr } = await query;
    if (fetchErr) return { success: false, error: fetchErr.message };
    if (!existingSource || existingSource.length === 0) {
      return { success: false, error: `No schedules found in source week (${srcMon} to ${srcSunday}) to copy.` };
    }

    let empQuery = supabase.from('employees').select('employee_id, status');
    if (rid) empQuery = empQuery.eq('restaurant_id', rid);
    const { data: empData } = await empQuery;
    const activeEmpIds = new Set(
      (empData || [])
        .filter((e: any) => e.status !== 'Inactive')
        .map((e: any) => e.employee_id)
    );

    const activeExistingSource = existingSource.filter((s: any) => activeEmpIds.has(s.employee_id));
    if (activeExistingSource.length === 0) {
      return { success: false, error: 'No schedules for active employees found to copy.' };
    }

    // Map each item by exact Day-of-Week (Monday -> Target Monday, ..., Sunday -> Target Sunday)
    const rawCopied = await Promise.all(
      activeExistingSource.map(async (item: any) => {
        const dayIdx = getDayIndex(item.date);
        const newDateStr = addDays(tgtMon, dayIdx);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, published_at, ...rest } = item;
        return injectRestaurantId({
          ...rest,
          date: newDateStr,
          status: 'draft',
          published_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      })
    );

    // Deduplicate in-memory to ensure no double-entries
    const uniqueMap = new Map<string, any>();
    for (const item of rawCopied) {
      const key = `${item.employee_id}_${item.date}_${item.assignment_type}_${item.start_time || ''}_${item.end_time || ''}_${item.shift_name || ''}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    let copied = Array.from(uniqueMap.values());

    // If overwriteExistingDrafts is enabled, delete existing draft schedules in target range first
    if (overwriteExistingDrafts) {
      let delQuery = supabase
        .from('employee_schedules')
        .delete()
        .gte('date', tgtMon)
        .lte('date', tgtSunday)
        .eq('status', 'draft');
      if (branch && branch !== 'All') delQuery = delQuery.eq('branch', branch);
      if (rid) delQuery = delQuery.eq('restaurant_id', rid);
      await delQuery;
    } else {
      let exTargetQuery = supabase
        .from('employee_schedules')
        .select('employee_id, date, assignment_type, start_time, end_time, shift_name')
        .gte('date', tgtMon)
        .lte('date', tgtSunday);
      if (branch && branch !== 'All') exTargetQuery = exTargetQuery.eq('branch', branch);
      if (rid) exTargetQuery = exTargetQuery.eq('restaurant_id', rid);
      const { data: existingTarget } = await exTargetQuery;

      if (existingTarget && existingTarget.length > 0) {
        const exKeys = new Set(
          existingTarget.map(
            (t: any) => `${t.employee_id}_${t.date}_${t.assignment_type}_${t.start_time || ''}_${t.end_time || ''}_${t.shift_name || ''}`
          )
        );
        copied = copied.filter((c) => {
          const k = `${c.employee_id}_${c.date}_${c.assignment_type}_${c.start_time || ''}_${c.end_time || ''}_${c.shift_name || ''}`;
          return !exKeys.has(k);
        });
      }
    }

    if (!copied.length) {
      return { success: true, count: 0, message: 'All shifts already exist in the target week.' };
    }

    for (let i = 0; i < copied.length; i += 50) {
      const batch = copied.slice(i, i + 50);
      const { error: insertErr } = await supabase.from('employee_schedules').insert(batch);
      if (insertErr) return { success: false, error: insertErr.message };
    }

    return { success: true, count: copied.length };
  },

  copyPreviousMonthSchedule: async (
    sourceMonthStr: string,
    targetMonthStr: string,
    branch?: string,
    overwriteExistingDrafts: boolean = true
  ) => {
    const rid = getRestaurantId();
    const [sYear, sMonth] = sourceMonthStr.split('-').map(Number);
    const [tYear, tMonth] = targetMonthStr.split('-').map(Number);

    const sStart = `${sourceMonthStr}-01`;
    const sLastDay = new Date(sYear, sMonth, 0).getDate();
    const sEnd = `${sourceMonthStr}-${String(sLastDay).padStart(2, '0')}`;

    const tStart = `${targetMonthStr}-01`;
    const tLastDay = new Date(tYear, tMonth, 0).getDate();
    const tEnd = `${targetMonthStr}-${String(tLastDay).padStart(2, '0')}`;

    let query = supabase.from('employee_schedules').select('*').gte('date', sStart).lte('date', sEnd);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: existingSource, error: fetchErr } = await query;
    if (fetchErr) return { success: false, error: fetchErr.message };
    if (!existingSource || existingSource.length === 0) {
      return { success: false, error: 'No schedules found in the source month to copy.' };
    }

    let empQuery = supabase.from('employees').select('employee_id, status');
    if (rid) empQuery = empQuery.eq('restaurant_id', rid);
    const { data: empData } = await empQuery;
    const activeEmpIds = new Set(
      (empData || [])
        .filter((e: any) => e.status !== 'Inactive')
        .map((e: any) => e.employee_id)
    );

    const activeExistingSource = existingSource.filter((s: any) => activeEmpIds.has(s.employee_id));
    if (activeExistingSource.length === 0) {
      return { success: false, error: 'No schedules for active employees found to copy.' };
    }

    const rawCopied: any[] = [];
    for (const item of activeExistingSource) {
      const dayNum = parseInt(item.date.split('-')[2], 10);
      if (dayNum <= tLastDay) {
        const newDateStr = `${targetMonthStr}-${String(dayNum).padStart(2, '0')}`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, published_at, ...rest } = item;
        rawCopied.push(
          await injectRestaurantId({
            ...rest,
            date: newDateStr,
            status: 'draft',
            published_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        );
      }
    }

    if (!rawCopied.length) return { success: false, error: 'No valid dates mapped.' };

    // Deduplicate in-memory
    const uniqueMap = new Map<string, any>();
    for (const item of rawCopied) {
      const key = `${item.employee_id}_${item.date}_${item.assignment_type}_${item.start_time || ''}_${item.end_time || ''}_${item.shift_name || ''}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    let copied = Array.from(uniqueMap.values());

    if (overwriteExistingDrafts) {
      let delQuery = supabase
        .from('employee_schedules')
        .delete()
        .gte('date', tStart)
        .lte('date', tEnd)
        .eq('status', 'draft');
      if (branch && branch !== 'All') delQuery = delQuery.eq('branch', branch);
      if (rid) delQuery = delQuery.eq('restaurant_id', rid);
      await delQuery;
    } else {
      let exTargetQuery = supabase
        .from('employee_schedules')
        .select('employee_id, date, assignment_type, start_time, end_time, shift_name')
        .gte('date', tStart)
        .lte('date', tEnd);
      if (branch && branch !== 'All') exTargetQuery = exTargetQuery.eq('branch', branch);
      if (rid) exTargetQuery = exTargetQuery.eq('restaurant_id', rid);
      const { data: existingTarget } = await exTargetQuery;

      if (existingTarget && existingTarget.length > 0) {
        const exKeys = new Set(
          existingTarget.map(
            (t: any) => `${t.employee_id}_${t.date}_${t.assignment_type}_${t.start_time || ''}_${t.end_time || ''}_${t.shift_name || ''}`
          )
        );
        copied = copied.filter((c) => {
          const k = `${c.employee_id}_${c.date}_${c.assignment_type}_${c.start_time || ''}_${c.end_time || ''}_${c.shift_name || ''}`;
          return !exKeys.has(k);
        });
      }
    }

    if (!copied.length) {
      return { success: true, count: 0, message: 'All schedules already exist in the target month.' };
    }

    for (let i = 0; i < copied.length; i += 50) {
      const batch = copied.slice(i, i + 50);
      const { error: insertErr } = await supabase.from('employee_schedules').insert(batch);
      if (insertErr) return { success: false, error: insertErr.message };
    }

    return { success: true, count: copied.length };
  },

  publishSchedules: async (startDate: string, endDate: string, branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('employee_schedules')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'draft');

    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);

    const { error } = await query;
    if (error) return { success: false, error: error.message };

    // Query ALL employees who are scheduled in this date range to receive the published notification
    let allEmpQuery = supabase
      .from('employee_schedules')
      .select('employee_id')
      .gte('date', startDate)
      .lte('date', endDate);

    if (branch && branch !== 'All') allEmpQuery = allEmpQuery.eq('branch', branch);
    if (rid) allEmpQuery = allEmpQuery.eq('restaurant_id', rid);

    const { data: allSchedData } = await allEmpQuery;

    if (allSchedData && allSchedData.length > 0) {
      const allEmpIds = Array.from(new Set(allSchedData.map((s) => s.employee_id)));
      const notifications = await Promise.all(
        allEmpIds.map((empId) =>
          injectRestaurantId({
            title: '📅 Work Schedule Published',
            message: `Your work schedule for ${startDate} to ${endDate} has been published. Please check your schedule for details.`,
            type: 'schedule_published',
            target_user_id: empId,
            is_read: false,
            created_at: new Date().toISOString()
          })
        )
      );
      await supabase.from('notifications').insert(notifications);
    }

    return { success: true, count: allSchedData?.length || 0 };
  },

  // ----------------------------------------------------
  // PAYROLL FINALIZATION API METHODS (Phase 3)
  // ----------------------------------------------------
  getPayrollPeriods: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('payroll_periods').select('*');
    if (branch && branch !== 'All') query = query.or(`branch.eq.${branch},branch.is.null`);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  savePayrollPeriod: async (period: any) => {
    const payload = await injectRestaurantId({ ...period, updated_at: new Date().toISOString() });
    if (!payload.id) delete payload.id;

    let res;
    if (period.id) {
      res = await supabase.from('payroll_periods').update(payload).eq('id', period.id);
    } else {
      res = await supabase.from('payroll_periods').insert([payload]).select('id').single();
    }
    if (res.error) return { success: false, error: res.error.message };
    return { success: true, data: res.data };
  },

  lockPayrollPeriod: async (periodId: string, lockedBy: string) => {
    const { error } = await supabase
      .from('payroll_periods')
      .update({
        status: 'locked',
        locked_at: new Date().toISOString(),
        locked_by: lockedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', periodId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getEmployeePayrollItems: async (payrollPeriodId: string) => {
    const { data, error } = await supabase
      .from('employee_payroll_items')
      .select('*')
      .eq('payroll_period_id', payrollPeriodId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveEmployeePayrollItemsBatch: async (items: any[]) => {
    if (!items.length) return { success: true, count: 0 };
    const prepared = await Promise.all(
      items.map(async (item) => {
        const p = await injectRestaurantId({ ...item, updated_at: new Date().toISOString() });
        if (!p.id) delete p.id;
        return p;
      })
    );

    const { data, error } = await supabase.from('employee_payroll_items').insert(prepared).select('id');
    if (error) return { success: false, error: error.message };
    return { success: true, count: data?.length || 0 };
  },

  // Leave Requests API
  getLeaveRequests: async (filters: { employeeId?: string; status?: string; startDate?: string; endDate?: string } = {}) => {
    let query = supabase.from('employee_leave_requests').select('*').order('start_date', { ascending: false });
    const rid = getRestaurantId();
    if (rid) query = query.eq('restaurant_id', rid);
    if (filters.employeeId && filters.employeeId !== 'All') query = query.eq('employee_id', filters.employeeId);
    if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
    if (filters.startDate) query = query.gte('start_date', filters.startDate);
    if (filters.endDate) query = query.lte('end_date', filters.endDate);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  createLeaveRequest: async (payload: {
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason?: string;
  }) => {
    const isShiftSwap = payload.leave_type === 'Shift Swap';
    const initialStatus = isShiftSwap ? 'pending_peer' : 'pending';

    const dataWithRid = await injectRestaurantId({
      ...payload,
      status: initialStatus
    });
    delete dataWithRid.id;
    const { data, error } = await supabase.from('employee_leave_requests').insert([dataWithRid]).select().single();
    if (error) return { success: false, error: error.message };

    // Broadcast notification to peers in same branch/department for shift swap
    if (isShiftSwap && data) {
      try {
        const { data: requester } = await supabase
          .from('employees')
          .select('first_name, last_name, branch, position, department')
          .eq('employee_id', payload.employee_id)
          .single();

        const reqName = requester
          ? `${requester.first_name || ''} ${requester.last_name || ''}`.trim()
          : payload.employee_id;

        let query = supabase
          .from('employees')
          .select('employee_id')
          .neq('employee_id', payload.employee_id);

        if (requester?.branch) query = query.eq('branch', requester.branch);
        if (requester?.department) query = query.eq('department', requester.department);

        const { data: peers } = await query;

        if (peers && peers.length > 0) {
          const notifications = await Promise.all(
            peers.map((p) =>
              injectRestaurantId({
                title: '🔄 New Shift Swap Available',
                message: `${reqName} is looking to swap their shift on ${payload.start_date}. Click to agree.`,
                type: 'shift_swap_request',
                target_user_id: p.employee_id,
                is_read: false,
                created_at: new Date().toISOString()
              })
            )
          );
          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifyErr) {
        console.error('Error dispatching shift swap notifications:', notifyErr);
      }
    }

    return { success: true, data };
  },

  agreeToShiftSwap: async (requestId: string, peerEmployeeId: string, peerName: string) => {
    const { data: reqData } = await supabase.from('employee_leave_requests').select('*').eq('id', requestId).single();
    if (!reqData) return { success: false, error: 'Shift swap request not found.' };

    const { error } = await supabase
      .from('employee_leave_requests')
      .update({
        status: 'pending_manager',
        peer_employee_id: peerEmployeeId,
        peer_agreed_at: new Date().toISOString(),
        review_notes: `Peer agreed: ${peerName}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };

    try {
      const { data: managers } = await supabase.from('employees').select('employee_id').in('role', ['Manager', 'Admin', 'SuperAdmin']);
      if (managers && managers.length > 0) {
        const notifications = await Promise.all(
          managers.map((m) =>
            injectRestaurantId({
              title: '📋 Shift Swap Agreed - Action Required',
              message: `${peerName} agreed to swap shift with employee ${reqData.employee_id} on ${reqData.start_date}. Manager review required.`,
              type: 'shift_swap_peer_agreed',
              target_user_id: m.employee_id,
              is_read: false,
              created_at: new Date().toISOString()
            })
          )
        );
        await supabase.from('notifications').insert(notifications);
      }
    } catch (notifyErr) {
      console.error('Error dispatching manager notification:', notifyErr);
    }

    return { success: true };
  },

  updateLeaveRequestStatus: async (id: string, status: string, reviewedBy: string, reviewNotes?: string) => {
    const { data: reqData } = await supabase.from('employee_leave_requests').select('*').eq('id', id).single();

    const { error } = await supabase
      .from('employee_leave_requests')
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    if (status === 'approved' && reqData) {
      try {
        const leaveType = (reqData.leave_type || '').toLowerCase();

        if (leaveType.includes('swap') && reqData.peer_employee_id) {
          // SHIFT SWAP APPROVAL LOGIC
          const targetDate = reqData.start_date;
          const empA = reqData.employee_id;
          const empB = reqData.peer_employee_id;

          const { data: schedA } = await supabase.from('employee_schedules').select('*').eq('employee_id', empA).eq('date', targetDate).single();
          const { data: schedB } = await supabase.from('employee_schedules').select('*').eq('employee_id', empB).eq('date', targetDate).single();

          if (schedA && schedB) {
            // Swap employee_ids on existing schedules
            await supabase.from('employee_schedules').update({ employee_id: empB, updated_at: new Date().toISOString() }).eq('id', schedA.id);
            await supabase.from('employee_schedules').update({ employee_id: empA, updated_at: new Date().toISOString() }).eq('id', schedB.id);
          } else if (schedA && !schedB) {
            // Assign SchedA to EmpB, and set EmpA to Day Off
            await supabase.from('employee_schedules').update({ employee_id: empB, updated_at: new Date().toISOString() }).eq('id', schedA.id);
            const offPayload = await injectRestaurantId({
              employee_id: empA,
              branch: schedA.branch || 'Main',
              date: targetDate,
              assignment_type: 'day_off',
              shift_name: 'DAY OFF',
              status: 'published',
              updated_at: new Date().toISOString()
            });
            delete offPayload.id;
            await supabase.from('employee_schedules').insert([offPayload]);
          }

          // Notify both employees
          const swapNotifications = await Promise.all([
            injectRestaurantId({
              title: '✅ Shift Swap Approved & Applied',
              message: `Your shift swap for ${targetDate} has been approved by ${reviewedBy} and applied to your schedule.`,
              type: 'shift_swap_approved',
              target_user_id: empA,
              is_read: false,
              created_at: new Date().toISOString()
            }),
            injectRestaurantId({
              title: '✅ Shift Swap Approved & Applied',
              message: `Your shift swap for ${targetDate} has been approved by ${reviewedBy} and applied to your schedule.`,
              type: 'shift_swap_approved',
              target_user_id: empB,
              is_read: false,
              created_at: new Date().toISOString()
            })
          ]);
          await supabase.from('notifications').insert(swapNotifications);
        } else {
          // REGULAR LEAVE APPROVAL LOGIC (Vacation, Sick, Unpaid)
          let assignmentType = 'unpaid_leave';
          let shiftName = 'UNPAID LEAVE';

          if (leaveType.includes('vacation')) {
            assignmentType = 'vacation';
            shiftName = 'VACATION LEAVE';
          } else if (leaveType.includes('sick')) {
            assignmentType = 'sick_leave';
            shiftName = 'SICK LEAVE';
          } else if (leaveType.includes('unpaid')) {
            assignmentType = 'unpaid_leave';
            shiftName = 'UNPAID LEAVE';
          } else {
            assignmentType = 'unpaid_leave';
            shiftName = reqData.leave_type?.toUpperCase() || 'UNPAID LEAVE';
          }

          const curDate = new Date(reqData.start_date);
          const endDate = new Date(reqData.end_date);

          const { data: empObj } = await supabase.from('employees').select('branch, position').eq('employee_id', reqData.employee_id).single();
          const branchName = empObj?.branch || 'Main';

          const scheduleBatch: any[] = [];

          while (curDate <= endDate) {
            const dateStr = curDate.toISOString().split('T')[0];

            await supabase.from('employee_schedules').delete().eq('employee_id', reqData.employee_id).eq('date', dateStr);

            scheduleBatch.push({
              employee_id: reqData.employee_id,
              branch: branchName,
              date: dateStr,
              assignment_type: assignmentType,
              shift_name: shiftName,
              position: empObj?.position || null,
              status: 'published',
              notes: reqData.reason ? `Approved Leave Request: ${reqData.reason}` : 'Approved Leave Request'
            });

            curDate.setDate(curDate.getDate() + 1);
          }

          if (scheduleBatch.length > 0) {
            const prepared = await Promise.all(scheduleBatch.map(async (s) => injectRestaurantId({ ...s, updated_at: new Date().toISOString() })));
            await supabase.from('employee_schedules').insert(prepared);
          }
        }
      } catch (syncErr) {
        console.error('Error syncing leave request to schedule:', syncErr);
      }
    }

    return { success: true };
  },

  // ----------------------------------------------------
  // EMPLOYEE ASSESSMENT API SUITE (FLOW Assessment Module)
  // ----------------------------------------------------

  getAssessmentTemplates: async (params?: { includeArchived?: boolean; position?: string }) => {
    try {
      const restId = getRestaurantId();
      let query = supabase
        .from('assessment_templates')
        .select(`
          *,
          assessment_template_sections (
            *,
            assessment_template_criteria (*),
            assessment_template_questions (*)
          )
        `)
        .order('name', { ascending: true });

      if (restId) {
        query = query.or(`restaurant_id.eq.${restId},restaurant_id.is.null`);
      }
      if (!params?.includeArchived) query = query.eq('is_archived', false);
      if (params?.position) query = query.eq('position', params.position);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (e: any) {
      console.error('Error in getAssessmentTemplates:', e);
      return { success: false, error: e.message };
    }
  },

  getAssessmentTemplateById: async (templateId: string) => {
    try {
      const { data: template, error: tErr } = await supabase
        .from('assessment_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (tErr) throw tErr;

      const { data: sections, error: sErr } = await supabase
        .from('assessment_template_sections')
        .select(`
          *,
          criteria:assessment_template_criteria (*),
          questions:assessment_template_questions (*)
        `)
        .eq('template_id', templateId)
        .order('display_order', { ascending: true });
      if (sErr) throw sErr;

      const sortedSections = (sections || []).map((sec: any) => ({
        ...sec,
        criteria: (sec.criteria || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
        questions: (sec.questions || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
      }));

      return { success: true, data: { ...template, sections: sortedSections } };
    } catch (e: any) {
      console.error('Error in getAssessmentTemplateById:', e);
      return { success: false, error: e.message };
    }
  },

  saveAssessmentTemplate: async (templateData: any) => {
    try {
      const payload = await injectRestaurantId({
        name: templateData.name,
        position: templateData.position,
        description: templateData.description,
        recommended_days_timing: templateData.recommended_days_timing ?? 10,
        default_evaluator_role: templateData.default_evaluator_role ?? 'Manager',
        practical_weight: templateData.practical_weight ?? 70,
        questions_weight: templateData.questions_weight ?? 30,
        passing_score: templateData.passing_score ?? 80,
        confirmation_threshold: templateData.confirmation_threshold ?? 80,
        probation_extension_min: templateData.probation_extension_min ?? 65,
        probation_extension_max: templateData.probation_extension_max ?? 79.99,
        dismissal_threshold: templateData.dismissal_threshold ?? 65,
        additional_rules: templateData.additional_rules || {},
        is_active: templateData.is_active ?? true,
        is_archived: templateData.is_archived ?? false,
        created_by: templateData.created_by,
        updated_at: new Date().toISOString(),
      });

      if (templateData.id) {
        const { data, error } = await supabase
          .from('assessment_templates')
          .update(payload)
          .eq('id', templateData.id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data, id: data.id };
      } else {
        const { data, error } = await supabase
          .from('assessment_templates')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return { success: true, data, id: data.id };
      }
    } catch (e: any) {
      console.error('Error in saveAssessmentTemplate:', e);
      return { success: false, error: e.message };
    }
  },

  duplicateAssessmentTemplate: async (templateId: string, authorName?: string) => {
    try {
      const fullRes = await api.getAssessmentTemplateById(templateId);
      if (!fullRes.success || !fullRes.data) throw new Error('Template not found');
      const original = fullRes.data;

      const newTemplatePayload = await injectRestaurantId({
        name: `${original.name} (Copy)`,
        position: original.position,
        description: original.description,
        version: 1,
        recommended_days_timing: original.recommended_days_timing,
        default_evaluator_role: original.default_evaluator_role,
        practical_weight: original.practical_weight,
        questions_weight: original.questions_weight,
        passing_score: original.passing_score,
        confirmation_threshold: original.confirmation_threshold,
        probation_extension_min: original.probation_extension_min,
        probation_extension_max: original.probation_extension_max,
        dismissal_threshold: original.dismissal_threshold,
        additional_rules: original.additional_rules,
        is_active: true,
        is_archived: false,
        created_by: authorName || 'Admin',
      });

      const { data: newTmpl, error: tmplErr } = await supabase
        .from('assessment_templates')
        .insert([newTemplatePayload])
        .select()
        .single();
      if (tmplErr) throw tmplErr;

      for (const sec of original.sections || []) {
        const secPayload = await injectRestaurantId({
          template_id: newTmpl.id,
          title: sec.title,
          description: sec.description,
          section_type: sec.section_type,
          category_group: sec.category_group,
          weight: sec.weight,
          display_order: sec.display_order,
          is_required: sec.is_required,
          is_active: sec.is_active,
        });

        const { data: newSec, error: secErr } = await supabase
          .from('assessment_template_sections')
          .insert([secPayload])
          .select()
          .single();
        if (secErr) throw secErr;

        for (const crit of sec.criteria || []) {
          const critPayload = await injectRestaurantId({
            section_id: newSec.id,
            template_id: newTmpl.id,
            name: crit.name,
            instructions: crit.instructions,
            expected_standard: crit.expected_standard,
            max_score: crit.max_score,
            weight_in_section: crit.weight_in_section,
            display_order: crit.display_order,
            is_required: crit.is_required,
            is_critical: crit.is_critical,
            allow_not_observed: crit.allow_not_observed,
            comment_required_below_score: crit.comment_required_below_score,
          });
          await supabase.from('assessment_template_criteria').insert([critPayload]);
        }

        for (const q of sec.questions || []) {
          const qPayload = await injectRestaurantId({
            section_id: newSec.id,
            template_id: newTmpl.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            expected_answer: q.expected_answer,
            max_score: q.max_score,
            weight_in_section: q.weight_in_section,
            display_order: q.display_order,
            is_required: q.is_required,
            is_critical: q.is_critical,
            mandatory_comment: q.mandatory_comment,
            allow_attachments: q.allow_attachments,
            category_tag: q.category_tag,
          });
          await supabase.from('assessment_template_questions').insert([qPayload]);
        }
      }

      return { success: true, data: newTmpl };
    } catch (e: any) {
      console.error('Error in duplicateAssessmentTemplate:', e);
      return { success: false, error: e.message };
    }
  },

  archiveAssessmentTemplate: async (templateId: string, isArchived: boolean) => {
    try {
      const { error } = await supabase
        .from('assessment_templates')
        .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Error in archiveAssessmentTemplate:', e);
      return { success: false, error: e.message };
    }
  },

  deleteAssessmentTemplate: async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('assessment_templates')
        .delete()
        .eq('id', templateId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Error in deleteAssessmentTemplate:', e);
      return { success: false, error: e.message };
    }
  },

  saveAssessmentSection: async (sectionData: any) => {
    try {
      const payload = await injectRestaurantId({
        template_id: sectionData.template_id,
        title: sectionData.title,
        description: sectionData.description,
        section_type: sectionData.section_type || 'practical_observation',
        category_group: sectionData.category_group || 'practical',
        weight: sectionData.weight ?? 0,
        display_order: sectionData.display_order ?? 1,
        is_required: sectionData.is_required ?? true,
        is_active: sectionData.is_active ?? true,
        updated_at: new Date().toISOString(),
      });

      if (sectionData.id) {
        const { data, error } = await supabase
          .from('assessment_template_sections')
          .update(payload)
          .eq('id', sectionData.id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data };
      } else {
        const { data, error } = await supabase
          .from('assessment_template_sections')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return { success: true, data };
      }
    } catch (e: any) {
      console.error('Error in saveAssessmentSection:', e);
      return { success: false, error: e.message };
    }
  },

  deleteAssessmentSection: async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('assessment_template_sections')
        .delete()
        .eq('id', sectionId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Error in deleteAssessmentSection:', e);
      return { success: false, error: e.message };
    }
  },

  saveAssessmentCriterion: async (criterionData: any) => {
    try {
      const payload = await injectRestaurantId({
        section_id: criterionData.section_id,
        template_id: criterionData.template_id,
        name: criterionData.name,
        instructions: criterionData.instructions,
        expected_standard: criterionData.expected_standard,
        max_score: criterionData.max_score ?? 5,
        weight_in_section: criterionData.weight_in_section ?? 1,
        display_order: criterionData.display_order ?? 1,
        is_required: criterionData.is_required ?? true,
        is_critical: criterionData.is_critical ?? false,
        allow_not_observed: criterionData.allow_not_observed ?? true,
        comment_required_below_score: criterionData.comment_required_below_score ?? 3,
        updated_at: new Date().toISOString(),
      });

      if (criterionData.id) {
        const { data, error } = await supabase
          .from('assessment_template_criteria')
          .update(payload)
          .eq('id', criterionData.id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data };
      } else {
        const { data, error } = await supabase
          .from('assessment_template_criteria')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return { success: true, data };
      }
    } catch (e: any) {
      console.error('Error in saveAssessmentCriterion:', e);
      return { success: false, error: e.message };
    }
  },

  deleteAssessmentCriterion: async (criterionId: string) => {
    try {
      const { error } = await supabase
        .from('assessment_template_criteria')
        .delete()
        .eq('id', criterionId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Error in deleteAssessmentCriterion:', e);
      return { success: false, error: e.message };
    }
  },

  saveAssessmentQuestion: async (questionData: any) => {
    try {
      const payload = await injectRestaurantId({
        section_id: questionData.section_id,
        template_id: questionData.template_id,
        question_text: questionData.question_text,
        question_type: questionData.question_type || 'scenario_roleplay',
        options: questionData.options,
        expected_answer: questionData.expected_answer,
        max_score: questionData.max_score ?? 5,
        weight_in_section: questionData.weight_in_section ?? 1,
        display_order: questionData.display_order ?? 1,
        is_required: questionData.is_required ?? true,
        is_critical: questionData.is_critical ?? false,
        mandatory_comment: questionData.mandatory_comment ?? false,
        allow_attachments: questionData.allow_attachments ?? true,
        category_tag: questionData.category_tag,
        updated_at: new Date().toISOString(),
      });

      if (questionData.id) {
        const { data, error } = await supabase
          .from('assessment_template_questions')
          .update(payload)
          .eq('id', questionData.id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data };
      } else {
        const { data, error } = await supabase
          .from('assessment_template_questions')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return { success: true, data };
      }
    } catch (e: any) {
      console.error('Error in saveAssessmentQuestion:', e);
      return { success: false, error: e.message };
    }
  },

  deleteAssessmentQuestion: async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('assessment_template_questions')
        .delete()
        .eq('id', questionId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Error in deleteAssessmentQuestion:', e);
      return { success: false, error: e.message };
    }
  },

  getEmployeeAssessments: async (filters?: {
    employeeId?: string;
    branch?: string;
    position?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    try {
      const restId = getRestaurantId();
      let query = supabase
        .from('employee_assessments')
        .select(`
          *,
          employees (employee_id, first_name, last_name, position, branch, department, date_started),
          assessment_templates (id, name, version, position)
        `)
        .order('created_at', { ascending: false });

      if (restId) query = query.eq('restaurant_id', restId);
      if (filters?.employeeId) query = query.eq('employee_id', filters.employeeId);
      if (filters?.branch) query = query.eq('branch', filters.branch);
      if (filters?.position) query = query.eq('position', filters.position);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.dateFrom) query = query.gte('assessment_date', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('assessment_date', filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (e: any) {
      console.error('Error in getEmployeeAssessments:', e);
      return { success: false, error: e.message };
    }
  },

  getEmployeeAssessmentById: async (assessmentId: string) => {
    try {
      const { data: assessment, error: aErr } = await supabase
        .from('employee_assessments')
        .select(`
          *,
          employees (employee_id, first_name, last_name, position, branch, department, date_started, phone),
          assessment_templates (id, name, version, position, practical_weight, questions_weight, passing_score, confirmation_threshold, probation_extension_min, probation_extension_max, dismissal_threshold)
        `)
        .eq('id', assessmentId)
        .single();
      if (aErr) throw aErr;

      const [scoresRes, answersRes, objectivesRes] = await Promise.all([
        supabase.from('assessment_criterion_scores').select('*').eq('assessment_id', assessmentId),
        supabase.from('assessment_question_answers').select('*').eq('assessment_id', assessmentId),
        supabase.from('assessment_reassessment_objectives').select('*').eq('assessment_id', assessmentId).order('objective_number', { ascending: true }),
      ]);

      return {
        success: true,
        data: {
          ...assessment,
          scores: scoresRes.data || [],
          answers: answersRes.data || [],
          objectives: objectivesRes.data || [],
        },
      };
    } catch (e: any) {
      console.error('Error in getEmployeeAssessmentById:', e);
      return { success: false, error: e.message };
    }
  },

  createEmployeeAssessment: async (params: {
    templateId: string;
    employeeId: string;
    position?: string;
    branch?: string;
    employmentStartDate?: string;
    assessmentDate?: string;
    assessmentPeriod?: string;
    daysWorked?: number;
    reason?: string;
    evaluatorName?: string;
    evaluatorUserId?: string;
    secondEvaluatorName?: string;
    parentAssessmentId?: string;
    isReassessment?: boolean;
    createdBy?: string;
  }) => {
    try {
      const tmplRes = await api.getAssessmentTemplateById(params.templateId);
      if (!tmplRes.success || !tmplRes.data) throw new Error('Template not found');
      const tmpl = tmplRes.data;

      const payload = await injectRestaurantId({
        employee_id: params.employeeId,
        template_id: params.templateId,
        template_snapshot: tmpl,
        position: params.position || tmpl.position,
        branch: params.branch || 'Main',
        employment_start_date: params.employmentStartDate,
        assessment_date: params.assessmentDate || new Date().toISOString().split('T')[0],
        assessment_period: params.assessmentPeriod || `${tmpl.recommended_days_timing || 10}-Day Probation`,
        days_worked: params.daysWorked ?? (tmpl.recommended_days_timing || 10),
        reason: params.reason || 'Initial probation',
        evaluator_name: params.evaluatorName || 'Manager',
        evaluator_user_id: params.evaluatorUserId,
        second_evaluator_name: params.secondEvaluatorName,
        parent_assessment_id: params.parentAssessmentId,
        is_reassessment: params.isReassessment || false,
        status: 'In Progress',
        provisional_score: 0,
        practical_score: 0,
        questions_score: 0,
        system_recommendation: 'Dismiss',
        created_by: params.createdBy || 'Manager',
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('employee_assessments')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      await supabase.from('assessment_audit_logs').insert([
        await injectRestaurantId({
          entity_type: 'assessment',
          entity_id: data.id,
          assessment_id: data.id,
          action: 'created',
          user_name: params.createdBy || params.evaluatorName || 'Manager',
          user_id: params.evaluatorUserId || null,
          details: { template_name: tmpl.name, employee_id: params.employeeId, is_reassessment: params.isReassessment },
          new_value: { template_name: tmpl.name, employee_id: params.employeeId, is_reassessment: params.isReassessment },
          performed_by_name: params.createdBy || params.evaluatorName || 'Manager',
          performed_by_id: params.evaluatorUserId,
        }),
      ]);

      return { success: true, data };
    } catch (e: any) {
      console.error('Error in createEmployeeAssessment:', e);
      return { success: false, error: e.message };
    }
  },

  saveAssessmentScoresAndAnswers: async (params: {
    assessmentId: string;
    scoresMap: Record<string, any>;
    answersMap: Record<string, any>;
    provisionalScore: number;
    practicalScore: number;
    questionsScore: number;
    hasCriticalFailure: boolean;
    criticalFailureDetails?: string[];
    systemRecommendation: string;
    status?: string;
    userName?: string;
    userId?: string;
  }) => {
    try {
      const { assessmentId, scoresMap, answersMap, provisionalScore, practicalScore, questionsScore, hasCriticalFailure, criticalFailureDetails, systemRecommendation, status } = params;

      const scoreInserts: any[] = [];
      for (const [criterionId, s] of Object.entries(scoresMap)) {
        scoreInserts.push(
          await injectRestaurantId({
            assessment_id: assessmentId,
            criterion_id: criterionId,
            section_id: s.section_id || null,
            score: s.is_not_observed ? null : s.score,
            is_not_observed: !!s.is_not_observed,
            comment: s.comment || null,
            evidence_url: s.evidence_url || null,
            needs_follow_up: !!s.needs_follow_up,
            updated_at: new Date().toISOString(),
          })
        );
      }

      const answerInserts: any[] = [];
      for (const [questionId, a] of Object.entries(answersMap)) {
        answerInserts.push(
          await injectRestaurantId({
            assessment_id: assessmentId,
            question_id: questionId,
            section_id: a.section_id || null,
            score: a.score,
            recorded_answer: a.recorded_answer || null,
            selected_option: a.selected_option || null,
            comment: a.comment || null,
            attachment_url: a.attachment_url || null,
            is_critical_failed: !!a.is_critical_failed,
            updated_at: new Date().toISOString(),
          })
        );
      }

      if (scoreInserts.length > 0) {
        const { error: sErr } = await supabase
          .from('assessment_criterion_scores')
          .upsert(scoreInserts, { onConflict: 'assessment_id,criterion_id' });
        if (sErr) throw sErr;
      }

      if (answerInserts.length > 0) {
        const { error: aErr } = await supabase
          .from('assessment_question_answers')
          .upsert(answerInserts, { onConflict: 'assessment_id,question_id' });
        if (aErr) throw aErr;
      }

      const updatePayload: any = {
        provisional_score: provisionalScore,
        practical_score: practicalScore,
        questions_score: questionsScore,
        has_critical_failure: hasCriticalFailure,
        critical_failure_details: criticalFailureDetails || [],
        system_recommendation: systemRecommendation,
        updated_at: new Date().toISOString(),
      };
      if (status) updatePayload.status = status;

      const { error: updErr } = await supabase
        .from('employee_assessments')
        .update(updatePayload)
        .eq('id', assessmentId);
      if (updErr) throw updErr;

      return { success: true };
    } catch (e: any) {
      console.error('Error in saveAssessmentScoresAndAnswers:', e);
      return { success: false, error: e.message };
    }
  },

  submitFinalAssessment: async (params: {
    assessmentId: string;
    managerDecision: 'Confirm Employment' | 'Extend Probation' | 'Dismiss';
    decisionReason?: string;
    decisionOverrideExplanation?: string;
    generalComments?: string;
    strengths?: string;
    weaknesses?: string;
    finalScore: number;
    practicalScore: number;
    questionsScore: number;
    hasCriticalFailure: boolean;
    criticalFailureDetails?: string[];
    systemRecommendation: string;
    userName?: string;
    userId?: string;
    objectives?: Array<{
      objective_number: number;
      objective_text: string;
      expected_standard: string;
      responsible_manager?: string;
      training_required?: string;
      target_completion_date?: string;
    }>;
  }) => {
    try {
      const {
        assessmentId,
        managerDecision,
        decisionReason,
        decisionOverrideExplanation,
        generalComments,
        strengths,
        weaknesses,
        finalScore,
        practicalScore,
        questionsScore,
        hasCriticalFailure,
        criticalFailureDetails,
        systemRecommendation,
        userName,
        userId,
        objectives,
      } = params;

      let finalStatus: string = 'Completed';
      if (managerDecision === 'Extend Probation') {
        finalStatus = 'Probation Extended';
      } else if (managerDecision === 'Dismiss') {
        finalStatus = 'Dismissed';
      }

      const updatePayload = {
        manager_decision: managerDecision,
        decision_reason: decisionReason,
        decision_override_explanation: decisionOverrideExplanation,
        general_comments: generalComments,
        strengths,
        weaknesses,
        final_score: finalScore,
        practical_score: practicalScore,
        questions_score: questionsScore,
        has_critical_failure: hasCriticalFailure,
        critical_failure_details: criticalFailureDetails || [],
        system_recommendation: systemRecommendation,
        status: finalStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from('employee_assessments')
        .update(updatePayload)
        .eq('id', assessmentId);
      if (updErr) throw updErr;

      await supabase.from('assessment_reassessment_objectives').delete().eq('assessment_id', assessmentId);

      if (managerDecision === 'Extend Probation' && objectives && objectives.length > 0) {
        const objInserts = await Promise.all(
          objectives.map(async (obj, idx) =>
            injectRestaurantId({
              assessment_id: assessmentId,
              objective_number: obj.objective_number || idx + 1,
              objective_text: obj.objective_text,
              expected_standard: obj.expected_standard,
              responsible_manager: obj.responsible_manager,
              training_required: obj.training_required,
              target_completion_date: obj.target_completion_date,
              created_at: new Date().toISOString(),
            })
          )
        );
        const { error: objErr } = await supabase
          .from('assessment_reassessment_objectives')
          .insert(objInserts);
        if (objErr) throw objErr;
      }

      await supabase.from('assessment_audit_logs').insert([
        await injectRestaurantId({
          entity_type: 'assessment',
          entity_id: assessmentId,
          assessment_id: assessmentId,
          action: 'submitted_final_decision',
          user_name: userName || 'Manager',
          user_id: userId || null,
          details: {
            manager_decision: managerDecision,
            final_score: finalScore,
            system_recommendation: systemRecommendation,
            overridden: managerDecision !== systemRecommendation,
          },
          new_value: {
            manager_decision: managerDecision,
            final_score: finalScore,
            system_recommendation: systemRecommendation,
            overridden: managerDecision !== systemRecommendation,
          },
          performed_by_name: userName || 'Manager',
          performed_by_id: userId,
        }),
      ]);

      return { success: true };
    } catch (e: any) {
      console.error('Error in submitFinalAssessment:', e);
      return { success: false, error: e.message };
    }
  },

  reopenAssessment: async (params: {
    assessmentId: string;
    reason: string;
    userName: string;
    userId?: string;
  }) => {
    try {
      const { assessmentId, reason, userName, userId } = params;

      const { error: updErr } = await supabase
        .from('employee_assessments')
        .update({
          status: 'In Progress',
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId);
      if (updErr) throw updErr;

      await supabase.from('assessment_audit_logs').insert([
        await injectRestaurantId({
          entity_type: 'assessment',
          entity_id: assessmentId,
          assessment_id: assessmentId,
          action: 'reopened',
          reason,
          user_name: userName,
          user_id: userId || null,
          details: { reopened_by: userName, reason },
          new_value: { reopened_by: userName, reason },
          performed_by_name: userName,
          performed_by_id: userId,
        }),
      ]);

      return { success: true };
    } catch (e: any) {
      console.error('Error in reopenAssessment:', e);
      return { success: false, error: e.message };
    }
  },

  recordEmployeeAcknowledgement: async (assessmentId: string, acknowledgementText: string, employeeName: string) => {
    try {
      const { error } = await supabase
        .from('employee_assessments')
        .update({
          employee_acknowledgement: acknowledgementText,
          employee_acknowledged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId);
      if (error) throw error;

      await supabase.from('assessment_audit_logs').insert([
        await injectRestaurantId({
          entity_type: 'assessment',
          entity_id: assessmentId,
          assessment_id: assessmentId,
          action: 'employee_acknowledged',
          user_name: employeeName,
          details: { acknowledgement: acknowledgementText },
          new_value: { acknowledgement: acknowledgementText },
          performed_by_name: employeeName,
        }),
      ]);

      return { success: true };
    } catch (e: any) {
      console.error('Error in recordEmployeeAcknowledgement:', e);
      return { success: false, error: e.message };
    }
  },

  getAssessmentDashboardMetrics: async (filters?: {
    branch?: string;
    position?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    try {
      const assessmentsRes = await api.getEmployeeAssessments(filters);
      if (!assessmentsRes.success || !assessmentsRes.data) {
        throw new Error(assessmentsRes.error || 'Failed to fetch assessments');
      }

      const list: any[] = assessmentsRes.data;

      let inProgress = 0;
      let completed = 0;
      let extendedProbation = 0;
      let reassessmentsDue = 0;
      let confirmed = 0;
      let dismissalCount = 0;
      let totalScoreSum = 0;
      let scoredCount = 0;

      const positionScores: Record<string, { sum: number; count: number }> = {};
      const branchScores: Record<string, { sum: number; count: number }> = {};

      list.forEach((item) => {
        if (item.status === 'In Progress' || item.status === 'Draft' || item.status === 'Assigned') {
          inProgress++;
        } else if (item.status === 'Completed' || item.status === 'Probation Extended' || item.status === 'Dismissed') {
          completed++;
        }

        if (item.status === 'Probation Extended') {
          extendedProbation++;
          reassessmentsDue++;
        }

        if (item.manager_decision === 'Confirm Employment' || (!item.manager_decision && item.system_recommendation === 'Confirm Employment')) {
          confirmed++;
        } else if (item.manager_decision === 'Dismiss' || (!item.manager_decision && item.system_recommendation === 'Dismiss')) {
          dismissalCount++;
        }

        const score = typeof item.final_score === 'number' ? item.final_score : null;
        if (score !== null && score > 0) {
          totalScoreSum += score;
          scoredCount++;

          const pos = item.position || 'Other';
          if (!positionScores[pos]) positionScores[pos] = { sum: 0, count: 0 };
          positionScores[pos].sum += score;
          positionScores[pos].count++;

          const br = item.branch || 'Main';
          if (!branchScores[br]) branchScores[br] = { sum: 0, count: 0 };
          branchScores[br].sum += score;
          branchScores[br].count++;
        }
      });

      const averageScore = scoredCount > 0 ? Math.round((totalScoreSum / scoredCount) * 100) / 100 : 0;

      const avgByPosition = Object.entries(positionScores).map(([pos, data]) => ({
        position: pos,
        average: Math.round((data.sum / data.count) * 10) / 10,
        count: data.count,
      }));

      const avgByBranch = Object.entries(branchScores).map(([br, data]) => ({
        branch: br,
        average: Math.round((data.sum / data.count) * 10) / 10,
        count: data.count,
      }));

      return {
        success: true,
        data: {
          totalAssessments: list.length,
          inProgress,
          completed,
          extendedProbation,
          reassessmentsDue,
          confirmed,
          dismissalCount,
          averageScore,
          avgByPosition,
          avgByBranch,
        },
      };
    } catch (e: any) {
      console.error('Error in getAssessmentDashboardMetrics:', e);
      return { success: false, error: e.message };
    }
  },

  // ==========================================
  // SALARY PAYMENTS & LOAN DEDUCTIONS API
  // ==========================================

  getPayrolls: async (month: number, year: number) => {
    let query = supabase.from('payrolls')
      .select('*, employees(employee_id, first_name, last_name, position, branch, department, salary, date_started)')
      .eq('month', month)
      .eq('year', year);
    const rid = getRestaurantId();
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  savePayroll: async (payroll: any) => {
    const payload = await injectRestaurantId({ ...payroll });
    const { data, error } = await supabase.from('payrolls').upsert(payload, { onConflict: 'employee_id, month, year' }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  batchSavePayrolls: async (payrolls: any[]) => {
    if (!payrolls || payrolls.length === 0) return { success: true, count: 0 };
    const payloads = await Promise.all(payrolls.map(p => injectRestaurantId({ ...p })));
    const { data, error } = await supabase.from('payrolls').upsert(payloads, { onConflict: 'employee_id, month, year' }).select();
    if (error) return { success: false, error: error.message };
    return { success: true, data, count: data?.length || 0 };
  },

  getSalaryPayments: async (month: number, year: number, employeeId?: string) => {
    let query = supabase.from('salary_payments')
      .select('*, employees(employee_id, first_name, last_name, position, branch, department)')
      .eq('month', month)
      .eq('year', year)
      .order('payment_date', { ascending: false });
    const rid = getRestaurantId();
    if (rid) query = query.eq('restaurant_id', rid);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  addSalaryPayment: async (payment: any) => {
    const payload = await injectRestaurantId({ ...payment });
    const { data, error } = await supabase.from('salary_payments').insert([payload]).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteSalaryPayment: async (id: string) => {
    const { error } = await supabase.from('salary_payments').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getActiveLoans: async (employeeId?: string) => {
    let query = supabase.from('loans')
      .select('*, employees(employee_id, first_name, last_name, branch)')
      .neq('status', 'Deleted')
      .gt('balance', 0)
      .order('date', { ascending: true });
    const rid = getRestaurantId();
    if (rid) query = query.eq('restaurant_id', rid);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  deductFromLoans: async (employeeId: string, deductionAmount: number, _adminName: string) => {
    if (deductionAmount <= 0) return { success: true };
    let query = supabase.from('loans')
      .select('*')
      .eq('employee_id', employeeId)
      .neq('status', 'Deleted')
      .gt('balance', 0)
      .order('date', { ascending: true });
    const rid = getRestaurantId();
    if (rid) query = query.eq('restaurant_id', rid);
    const { data: loans, error } = await query;
    if (error) return { success: false, error: error.message };

    let remainingToDeduct = deductionAmount;
    for (const l of (loans || [])) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(remainingToDeduct, Number(l.balance));
      remainingToDeduct -= deduct;
      const newRefunded = Number(l.total_refunded || 0) + deduct;
      const newBalance = Number(l.balance) - deduct;
      const newStatus = newBalance <= 0 ? 'Completed' : (l.status || 'Active');

      await supabase.from('loans').update({
        total_refunded: newRefunded,
        balance: newBalance,
        status: newStatus
      }).eq('loan_id', l.loan_id);
    }
    return { success: true };
  },

  getCashoutSalaryCandidates: async (month: number, year: number) => {
    const monthStr = month.toString().padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${daysInMonth}`;

    let query = supabase.from('daily_payments')
      .select('*')
      .eq('type', 'Cashout Salary')
      .gte('date', startDate)
      .lte('date', endDate);
    const rid = getRestaurantId();
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: dps, error: dpErr } = await query;
    if (dpErr) return { success: false, error: dpErr.message };

    const existingRes = await api.getSalaryPayments(month, year);
    const existingDpIds = new Set((existingRes.data || []).map((sp: any) => sp.daily_payment_id).filter(Boolean));

    const candidates = (dps || []).map((dp: any) => ({
      ...dp,
      already_synced: existingDpIds.has(dp.id)
    }));

    return { success: true, data: candidates };
  },

  syncCashoutSalaryPayments: async (candidates: any[], adminName: string, employees: any[]) => {
    const unlinked = candidates.filter((c: any) => !c.already_synced);
    if (unlinked.length === 0) return { success: true, count: 0 };

    const empMap = new Map<string, any>();
    employees.forEach((e: any) => {
      const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim().toLowerCase();
      empMap.set(fullName, e);
      if (e.employee_id) empMap.set(String(e.employee_id).toLowerCase(), e);
    });

    let insertedCount = 0;
    for (const dp of unlinked) {
      const supName = (dp.supplier || '').trim().toLowerCase();
      const matchedEmp = empMap.get(supName);
      if (!matchedEmp) continue;

      const pDate = dp.date || new Date().toISOString().split('T')[0];
      const parts = pDate.split('-');
      const pYear = parseInt(parts[0], 10);
      const pMonth = parseInt(parts[1], 10);

      const payload = await injectRestaurantId({
        employee_id: matchedEmp.employee_id,
        month: pMonth,
        year: pYear,
        payment_date: pDate,
        amount_usd: Number(dp.amount_usd) || 0,
        amount_lbp: Number(dp.amount_lbp) || 0,
        payment_method: 'Cashout Salary',
        daily_payment_id: dp.id,
        notes: `Imported from shift ${dp.shift || 'AM/PM'} cash drawer (${dp.branch || ''})`,
        created_by: adminName || 'Admin'
      });

      const { error } = await supabase.from('salary_payments').insert([payload]);
      if (!error) insertedCount++;
    }

    return { success: true, count: insertedCount };
  },

  updateSalarySlipStatus: async (employeeId: string, month: number, year: number, status: string, adminName: string) => {
    const payload = await injectRestaurantId({
      employee_id: employeeId,
      month,
      year,
      status,
      paid_at: status === '100% Paid' ? new Date().toISOString() : null,
      paid_by: status === '100% Paid' ? adminName : null,
    });

    const { data, error } = await supabase.from('payrolls').upsert(payload, { onConflict: 'employee_id, month, year' }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ==========================================
  // PHASE 5: PURCHASING, REPLENISHMENT & SCORECARD
  // ==========================================
  upsertSupplierPriceList: async (params: {
    supplier_id: string;
    item_id: string;
    purchase_unit: string;
    purchase_unit_price: number;
    base_quantity_per_purchase_unit: number;
    moq?: number;
    lead_time_days?: number;
    supplier_sku?: string;
    is_preferred_supplier?: boolean;
    effective_from?: string;
    effective_to?: string | null;
  }) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('upsert_supplier_price_list', {
      p_restaurant_id: rid,
      p_supplier_id: params.supplier_id,
      p_item_id: params.item_id,
      p_purchase_unit: params.purchase_unit,
      p_purchase_unit_price: params.purchase_unit_price,
      p_base_quantity_per_purchase_unit: params.base_quantity_per_purchase_unit,
      p_moq: params.moq ?? 1,
      p_lead_time_days: params.lead_time_days ?? 1,
      p_supplier_sku: params.supplier_sku ?? null,
      p_is_preferred_supplier: params.is_preferred_supplier ?? false,
      p_effective_from: params.effective_from ?? new Date().toISOString().split('T')[0],
      p_effective_to: params.effective_to ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getSuggestedReorderList: async (branchId: string, locationId: string) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('get_suggested_reorder_list', {
      p_restaurant_id: rid,
      p_branch_id: branchId,
      p_location_id: locationId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  convertRequisitionsToPos: async (requisitionIds: string[], userId: string, userName: string) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('convert_requisitions_to_pos', {
      p_restaurant_id: rid,
      p_requisition_ids: requisitionIds,
      p_user_id: userId,
      p_user_name: userName,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  approvePurchaseOrder: async (poId: string, userId: string, userName: string) => {
    const { data, error } = await supabase.rpc('approve_purchase_order', {
      p_po_id: poId,
      p_user_id: userId,
      p_user_name: userName,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  issuePurchaseOrder: async (poId: string, userId: string, userName: string) => {
    const { data, error } = await supabase.rpc('issue_purchase_order', {
      p_po_id: poId,
      p_user_id: userId,
      p_user_name: userName,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  closeShortPurchaseOrder: async (poId: string, reason: string, userId: string, userName: string) => {
    const { data, error } = await supabase.rpc('close_short_purchase_order', {
      p_po_id: poId,
      p_reason: reason,
      p_user_id: userId,
      p_user_name: userName,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  reopenClosedShortPurchaseOrder: async (poId: string, reason: string, userId: string, userName: string) => {
    const { data, error } = await supabase.rpc('reopen_closed_short_purchase_order', {
      p_po_id: poId,
      p_reason: reason,
      p_user_id: userId,
      p_user_name: userName,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  processGoodsReceiptWithPO: async (params: {
    receipt_id: string;
    user_id?: string;
    user_name?: string;
    lot_allocations?: any;
    allow_over_receipt_override?: boolean;
    override_reason?: string;
  }) => {
    const { data, error } = await supabase.rpc('process_goods_receipt', {
      p_receipt_id: params.receipt_id,
      p_user_id: params.user_id ?? null,
      p_user_name: params.user_name ?? null,
      p_lot_allocations: params.lot_allocations ?? null,
      p_allow_over_receipt_override: params.allow_over_receipt_override ?? false,
      p_override_reason: params.override_reason ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  reverseGoodsReceiptWithPO: async (receiptId: string, reason: string, userId?: string, userName?: string) => {
    const { data, error } = await supabase.rpc('reverse_goods_receipt', {
      p_receipt_id: receiptId,
      p_reason: reason,
      p_user_id: userId ?? null,
      p_user_name: userName ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getSupplierPerformanceScorecard: async (supplierId: string) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('get_supplier_performance_scorecard', {
      p_restaurant_id: rid,
      p_supplier_id: supplierId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // --------------------------------------------------------------------------
  // PHASE 6: INVENTORY INTELLIGENCE & ANALYTICS RPCs
  // --------------------------------------------------------------------------

  getInventoryValuationReport: async (params?: { branch_id?: string; as_of_date?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    if (params?.as_of_date !== undefined) payload.p_as_of_date = params.as_of_date;
    const { data, error } = await supabase.rpc('get_inventory_valuation_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getCogsAndVarianceReport: async (params?: { branch_id?: string; start_date?: string; end_date?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    if (params?.start_date !== undefined) payload.p_start_date = params.start_date;
    if (params?.end_date !== undefined) payload.p_end_date = params.end_date;
    const { data, error } = await supabase.rpc('get_cogs_and_variance_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getWasteAnalyticsReport: async (params?: { branch_id?: string; start_date?: string; end_date?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    if (params?.start_date !== undefined) payload.p_start_date = params.start_date;
    if (params?.end_date !== undefined) payload.p_end_date = params.end_date;
    const { data, error } = await supabase.rpc('get_waste_analytics_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getExpiryRiskReport: async (params?: { branch_id?: string; days_threshold?: number }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    if (params?.days_threshold !== undefined) payload.p_days_threshold = params.days_threshold;
    const { data, error } = await supabase.rpc('get_expiry_risk_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getStockDaysAndTurnoverReport: async (params?: { branch_id?: string; period_days?: number }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    if (params?.period_days !== undefined) payload.p_period_days = params.period_days;
    const { data, error } = await supabase.rpc('get_stock_days_and_turnover_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getProductionYieldAnalyticsReport: async (params?: { branch_id?: string; start_date?: string; end_date?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    if (params?.start_date !== undefined) payload.p_start_date = params.start_date;
    if (params?.end_date !== undefined) payload.p_end_date = params.end_date;
    const { data, error } = await supabase.rpc('get_production_yield_analytics_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getPurchasePriceTrendsReport: async (params?: { item_id?: string; months?: number }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.item_id !== undefined) payload.p_item_id = params.item_id;
    if (params?.months !== undefined) payload.p_months = params.months;
    const { data, error } = await supabase.rpc('get_purchase_price_trends_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getInventoryHealthAndExceptionsReport: async (params?: { branch_id?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.branch_id !== undefined) payload.p_branch_id = params.branch_id;
    const { data, error } = await supabase.rpc('get_inventory_health_and_exceptions_report', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getBranchComparisonDashboard: async (params?: { start_date?: string; end_date?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.start_date !== undefined) payload.p_start_date = params.start_date;
    if (params?.end_date !== undefined) payload.p_end_date = params.end_date;
    const { data, error } = await supabase.rpc('get_branch_comparison_dashboard', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  captureDailyInventorySnapshot: async (params?: { snapshot_date?: string; force_recalculate?: boolean }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.snapshot_date !== undefined) payload.p_snapshot_date = params.snapshot_date;
    if (params?.force_recalculate !== undefined) payload.p_force_recalculate = params.force_recalculate;
    // Uses authenticated administrative wrapper
    const { data, error } = await supabase.rpc('admin_recalculate_daily_snapshot', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  catchupDailyInventorySnapshots: async (params?: { days_back?: number }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.days_back !== undefined) payload.p_days_back = params.days_back;
    // Uses authenticated administrative wrapper
    const { data, error } = await supabase.rpc('admin_catchup_daily_snapshots', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Phase 7: Demand Forecasting & Smart Replenishment
  generateReplenishmentRecommendations: async (params: {
    branch_id: string;
    horizon_days?: number;
    lookback_days?: number;
    category?: string;
    department?: string;
    supplier_id?: string;
    stock_filter?: string;
  }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid, p_branch_id: params.branch_id };
    if (params.horizon_days !== undefined) payload.p_horizon_days = params.horizon_days;
    if (params.lookback_days !== undefined) payload.p_lookback_days = params.lookback_days;
    if (params.category !== undefined) payload.p_category = params.category;
    if (params.department !== undefined) payload.p_department = params.department;
    if (params.supplier_id !== undefined) payload.p_supplier_id = params.supplier_id;
    if (params.stock_filter !== undefined) payload.p_stock_filter = params.stock_filter;
    const { data, error } = await supabase.rpc('generate_replenishment_recommendations', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getReplenishmentPlanningSummary: async (params: { branch_id: string; batch_id?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid, p_branch_id: params.branch_id };
    if (params.batch_id !== undefined) payload.p_batch_id = params.batch_id;
    const { data, error } = await supabase.rpc('get_replenishment_planning_summary', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getReplenishmentBatchesHistory: async (params: { branch_id: string; limit?: number }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid, p_branch_id: params.branch_id };
    if (params.limit !== undefined) payload.p_limit = params.limit;
    const { data, error } = await supabase.rpc('get_replenishment_batches_history', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getReplenishmentRecommendationsList: async (params: {
    branch_id: string;
    batch_id?: string;
    status_filter?: string;
    category_filter?: string;
    department_filter?: string;
    supplier_filter?: string;
    stock_filter?: string;
  }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid, p_branch_id: params.branch_id };
    if (params.batch_id !== undefined) payload.p_batch_id = params.batch_id;
    if (params.status_filter !== undefined) payload.p_status_filter = params.status_filter;
    if (params.category_filter !== undefined) payload.p_category_filter = params.category_filter;
    if (params.department_filter !== undefined) payload.p_department_filter = params.department_filter;
    if (params.supplier_filter !== undefined) payload.p_supplier_filter = params.supplier_filter;
    if (params.stock_filter !== undefined) payload.p_stock_filter = params.stock_filter;
    const { data, error } = await supabase.rpc('get_replenishment_recommendations_list', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  overrideReplenishmentRecommendationItem: async (params: {
    item_rec_id: string;
    action: string;
    override_qty?: number;
    override_supplier_id?: string;
    notes?: string;
    override_priority?: string;
    assigned_to_user_id?: string;
    assigned_to_user_name?: string;
    required_by_date?: string;
  }) => {
    const rid = getRestaurantId();
    const payload: any = {
      p_restaurant_id: rid,
      p_item_rec_id: params.item_rec_id,
      p_action: params.action
    };
    if (params.override_qty !== undefined) payload.p_override_qty = params.override_qty;
    if (params.override_supplier_id !== undefined) payload.p_override_supplier_id = params.override_supplier_id;
    if (params.notes !== undefined) payload.p_notes = params.notes;
    if (params.override_priority !== undefined) payload.p_override_priority = params.override_priority;
    if (params.assigned_to_user_id !== undefined) payload.p_assigned_to_user_id = params.assigned_to_user_id;
    if (params.assigned_to_user_name !== undefined) payload.p_assigned_to_user_name = params.assigned_to_user_name;
    if (params.required_by_date !== undefined) payload.p_required_by_date = params.required_by_date;
    const { data, error } = await supabase.rpc('override_replenishment_recommendation_item', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  convertReplenishmentBatchToPurchaseOrders: async (params: {
    batch_id: string;
    supplier_ids?: string[];
    item_rec_ids?: string[];
  }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid, p_batch_id: params.batch_id };
    if (params.supplier_ids !== undefined) payload.p_supplier_ids = params.supplier_ids;
    if (params.item_rec_ids !== undefined) payload.p_item_rec_ids = params.item_rec_ids;
    const { data, error } = await supabase.rpc('convert_replenishment_batch_to_purchase_orders', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  previewProductionBomConsolidation: async (params: {
    branch_id: string;
    items: Array<{ item_id: string; recipe_id?: string; quantity: number }>;
  }) => {
    const rid = getRestaurantId();
    const payload: any = {
      p_restaurant_id: rid,
      p_branch_id: params.branch_id,
      p_items: params.items,
    };
    const { data, error } = await supabase.rpc('preview_production_bom_consolidation', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  createShortageDraftPurchaseOrders: async (params: {
    branch_id: string;
    batch_id?: string;
    shortage_items: Array<{
      item_id: string;
      supplier_id: string;
      quantity: number;
      pack_size?: number;
      purchase_unit?: string;
      unit_cost_usd?: number;
    }>;
  }) => {
    const rid = getRestaurantId();
    const payload: any = {
      p_restaurant_id: rid,
      p_branch_id: params.branch_id,
      p_batch_id: params.batch_id || null,
      p_shortage_items: params.shortage_items,
    };
    const { data, error } = await supabase.rpc('create_shortage_draft_purchase_orders', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  convertReplenishmentToProductionBatches: async (params: {
    batch_id: string;
    items: Array<{
      item_rec_id: string;
      recipe_id?: string;
      quantity?: number;
      priority?: string;
      required_by_date?: string;
      suggested_production_date?: string;
      department?: string;
      assigned_to_user_id?: string;
      assigned_to_user_name?: string;
    }>;
    user_id?: string;
    user_name?: string;
  }) => {
    const rid = getRestaurantId();
    const payload: any = {
      p_restaurant_id: rid,
      p_batch_id: params.batch_id,
      p_items: params.items,
      p_user_id: params.user_id || null,
      p_user_name: params.user_name || null,
    };
    const { data, error } = await supabase.rpc('convert_replenishment_to_production_batches', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveReplenishmentAiInsights: async (params: {
    batch_id: string;
    summary: any;
    item_insights: any[];
  }) => {
    const rid = getRestaurantId();
    const payload: any = {
      p_restaurant_id: rid,
      p_batch_id: params.batch_id,
      p_summary: params.summary,
      p_item_insights: params.item_insights,
    };
    const { data, error } = await supabase.rpc('save_replenishment_ai_insights', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  approveProductionBatch: async (params: {
    batch_id: string;
    user_id?: string;
    user_name?: string;
  }) => {
    const payload: any = {
      p_batch_id: params.batch_id,
      p_user_id: params.user_id || null,
      p_user_name: params.user_name || null,
    };
    const { data, error } = await supabase.rpc('approve_production_batch', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getReplenishmentDecisionHistory: async (params?: { batch_id?: string; item_rec_id?: string }) => {
    const rid = getRestaurantId();
    const payload: any = { p_restaurant_id: rid };
    if (params?.batch_id !== undefined) payload.p_batch_id = params.batch_id;
    if (params?.item_rec_id !== undefined) payload.p_item_rec_id = params.item_rec_id;
    const { data, error } = await supabase.rpc('get_replenishment_decision_history', payload);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // --- PHASE 2 & 12 PURCHASING & SUPPLIER INVOICE METHODS ---
  getPurchaseOrders: async (params?: { branch_id?: string; supplier_id?: string; status?: string; search?: string }) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        items:purchase_order_items(*)
      `)
      .order('created_at', { ascending: false });

    if (rid) query = query.eq('restaurant_id', rid);
    if (params?.branch_id && params.branch_id !== 'All') query = query.eq('branch_id', params.branch_id);
    if (params?.supplier_id && params.supplier_id !== 'All') query = query.eq('supplier_id', params.supplier_id);
    if (params?.status && params.status !== 'All') query = query.eq('status', params.status);
    if (params?.search && params.search.trim()) {
      query = query.ilike('po_number', `%${params.search.trim()}%`);
    }

    const { data, error } = await query.limit(500);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getPurchaseOrderById: async (poId: string) => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        items:purchase_order_items(*),
        dispatches:purchase_order_dispatches(*)
      `)
      .eq('id', poId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  createOrUpdatePurchaseOrder: async (payload: any) => {
    const rid = payload.restaurant_id || getRestaurantId();
    const { data, error } = await supabase.rpc('create_or_update_purchase_order', {
      p_payload: { ...payload, restaurant_id: rid }
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  recordPurchaseOrderDispatch: async (payload: any) => {
    const rid = payload.restaurant_id || getRestaurantId();
    const { data, error } = await supabase.rpc('record_purchase_order_dispatch', {
      p_payload: { ...payload, restaurant_id: rid }
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  approvePurchaseOrder: async (poId: string, userId: string, userName: string) => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'APPROVED',
        approved_by_id: userId,
        approved_by_name: userName,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', poId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  cancelPurchaseOrder: async (poId: string, reason: string, userId: string, userName: string) => {
    const { data, error } = await supabase.rpc('cancel_purchase_order', {
      p_po_id: poId,
      p_reason: reason,
      p_user_id: userId,
      p_user_name: userName
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  closeShortPurchaseOrder: async (poId: string, reason: string, userId: string, userName: string) => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'CLOSED_SHORT',
        notes: reason ? `Closed short: ${reason}` : 'Closed short',
        updated_at: new Date().toISOString()
      })
      .eq('id', poId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
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

  getSupplierPayableLedger: async (supplierId?: string) => {
    const rid = getRestaurantId();
    const { data, error } = await supabase.rpc('get_supplier_payable_ledger', {
      p_restaurant_id: rid,
      p_supplier_id: supplierId || null
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getSupplierInvoices: async (params?: { supplier_id?: string; branch_id?: string; status?: string }) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('supplier_invoices')
      .select(`
        *,
        supplier:suppliers(name, phone),
        items:supplier_invoice_items(*)
      `)
      .order('invoice_date', { ascending: false });

    if (rid) query = query.eq('restaurant_id', rid);
    if (params?.supplier_id && params.supplier_id !== 'All') query = query.eq('supplier_id', params.supplier_id);
    if (params?.branch_id && params.branch_id !== 'All') query = query.eq('branch_id', params.branch_id);
    if (params?.status && params.status !== 'All') query = query.eq('payment_status', params.status);

    const { data, error } = await query.limit(500);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getSupplierPayments: async (params?: { supplier_id?: string; branch_id?: string }) => {
    const rid = getRestaurantId();
    let query = supabase
      .from('supplier_payments')
      .select(`
        *,
        supplier:suppliers(name),
        allocations:supplier_payment_allocations(*)
      `)
      .order('payment_date', { ascending: false });

    if (rid) query = query.eq('restaurant_id', rid);
    if (params?.supplier_id && params.supplier_id !== 'All') query = query.eq('supplier_id', params.supplier_id);
    if (params?.branch_id && params.branch_id !== 'All') query = query.eq('branch_id', params.branch_id);

    const { data, error } = await query.limit(500);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
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
      p_source_type: params.sourceType || null,
      p_source_id: params.sourceId || null,
      p_authorized_by: params.authorizedBy || null,
      p_created_by: params.createdBy || null,
      p_idempotency_key: params.idempotencyKey || null
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  // Packaging Options (supplier_price_lists)
  getAllItemPackagingOptions: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('supplier_price_lists').select('*').order('created_at', { ascending: false });
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getItemPackagingOptions: async (itemId: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('supplier_price_lists').select('*').eq('item_id', itemId);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveItemPackagingOption: async (payload: any) => {
    const rid = payload.restaurant_id || getRestaurantId();
    const { data, error } = await supabase.from('supplier_price_lists').upsert({
      ...payload,
      restaurant_id: rid
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteItemPackagingOption: async (id: string, cascadeConversions: boolean = false) => {
    const { error } = await supabase.from('supplier_price_lists').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  checkItemHasHistory: async (itemId: string) => {
    try {
      const [txRes, piRes] = await Promise.all([
        supabase.from('inventory_transactions').select('id', { count: 'exact', head: true }).eq('item_id', itemId),
        supabase.from('purchase_invoice_items').select('id', { count: 'exact', head: true }).eq('item_id', itemId)
      ]);
      const txCount = txRes.count || 0;
      const piCount = piRes.count || 0;
      const hasHistory = (txCount + piCount) > 0;
      return {
        success: true,
        data: {
          has_history: hasHistory,
          current_stock: 0,
          transaction_count: txCount + piCount
        }
      };
    } catch (err: any) {
      return { success: true, data: { has_history: false, current_stock: 0, transaction_count: 0 } };
    }
  },

  // -------------------------------------------------------------
  // POS Invoice Generator & Synthetic Migration
  // -------------------------------------------------------------
  getProductsForInvoiceGenerator: async (restaurantId?: string) => {
    const rid = restaurantId || getRestaurantId();
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        unit_price_usd,
        is_active,
        status,
        category_id
      `)
      .eq('is_active', true)
      .gt('price', 0)
      .order('name');

    if (rid) query = query.eq('restaurant_id', rid);

    const { data: prods, error: pErr } = await query;
    if (pErr) return { success: false, error: pErr.message };

    let catQuery = supabase.from('categories').select('id, name, section').order('display_order');
    if (rid) catQuery = catQuery.eq('restaurant_id', rid);
    const { data: cats } = await catQuery;
    const catMap = new Map<string, string>();
    const sectionMap = new Map<string, string>();
    (cats || []).forEach((c: any) => {
      catMap.set(String(c.id), c.name || 'General');
      if (c.section) sectionMap.set(String(c.id), c.section);
    });

    const mapped = (prods || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price || p.unit_price_usd || 0),
      category_id: p.category_id,
      category_name: p.category_id ? (catMap.get(String(p.category_id)) || 'General') : 'General',
      department: p.category_id ? (sectionMap.get(String(p.category_id)) || '') : ''
    }));

    return { success: true, data: mapped };
  },

  saveSyntheticInvoiceBatch: async (batchId: string, invoices: any[], userName?: string) => {
    const { data, error } = await supabase.rpc('save_synthetic_pos_invoices', {
      p_batch_id: batchId,
      p_invoices: invoices,
      p_user_name: userName || 'Admin Migration'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  executePosOrderCogs: async (orderId: number, userName?: string) => {
    const { data, error } = await supabase.rpc('execute_pos_finished_goods_cogs', {
      p_order_id: orderId,
      p_user_name: userName || 'POS System'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  reversePosOrderCogs: async (orderId: number, reason?: string) => {
    const { data, error } = await supabase.rpc('reverse_pos_order_cogs', {
      p_order_id: orderId,
      p_reason: reason || 'Order Void/Cancellation'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // MULTI-CONCEPT INVOICE NUMBERING & CANCELLATION METHODS
  allocateConceptInvoiceNumber: async (orderId: number, idempotencyKey?: string, fiscalSeries?: string) => {
    const { data, error } = await supabase.rpc('allocate_concept_invoice_number', {
      p_order_id: orderId,
      p_idempotency_key: idempotencyKey || null,
      p_fiscal_series: fiscalSeries || null
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  cancelPosOrderInvoice: async (orderId: number, reason: string, canceledBy?: string) => {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A mandatory cancellation reason must be provided.' };
    }
    const { data, error } = await supabase.rpc('cancel_pos_order_invoice', {
      p_order_id: orderId,
      p_reason: reason.trim(),
      p_canceled_by: canceledBy || 'Web Admin'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  deleteUnissuedPosOrder: async (orderId: number) => {
    const { data, error } = await supabase.rpc('delete_unissued_pos_order', {
      p_order_id: orderId
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getConceptInvoiceSequences: async (conceptId?: string) => {
    let query = supabase.from('concept_invoice_sequences').select('*');
    if (conceptId) query = query.eq('concept_id', conceptId);
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  getChannelInvoiceSeriesMapping: async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'channel_invoice_series_mapping')
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data?.setting_value) {
      return {
        success: true,
        data: {
          WHATSAPP: 'A',
          DIRECT_APP: 'A',
          PHONE: 'A',
          DINE_IN: 'STANDARD',
          POS: 'STANDARD',
          POS_PICKUP: 'STANDARD',
          TOTERS: 'STANDARD',
          NOKNOK: 'STANDARD'
        }
      };
    }
    try {
      return { success: true, data: JSON.parse(data.setting_value) };
    } catch {
      return { success: true, data: {} };
    }
  }
};
