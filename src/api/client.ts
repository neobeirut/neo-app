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
        if (cachedUser?.restaurant_id) {
          return cachedUser.restaurant_id;
        }
      }
    }
  } catch {}
  return cachedRestaurantId;
}

export const api = {
  // Authentication
  login: async (emailOrPin: string, password?: string) => {
    const cleanInput = emailOrPin.trim();
    if (password) {
      const normalizedEmail = cleanInput.toLowerCase();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) return { success: false, error: authError.message };

      let { data, error } = await supabase
        .from('users')
        .select('*, restaurants:restaurant_id(*)')
        .eq('email', normalizedEmail)
        .single();

      // Fallback for old database schemas that do not have the restaurant_id column/relationship
      if (error && (error.message.includes('relationship') || error.message.includes('restaurant_id'))) {
        const fallbackRes = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error || !data) return { success: false, error: 'User profile not found.' };

      if (data.role !== 'Admin' && data.role !== 'Manager' && data.role !== 'SuperAdmin') {
        return { success: false, error: 'Access denied. Only Admins and Managers can access the web dashboard.' };
      }

      return { success: true, data };
    } else {
      let { data, error } = await supabase
        .from('users')
        .select('*, restaurants:restaurant_id(*)')
        .eq('pin', cleanInput)
        .single();
        
      // Fallback for old database schemas that do not have the restaurant_id column/relationship
      if (error && (error.message.includes('relationship') || error.message.includes('restaurant_id'))) {
        const fallbackRes = await supabase
          .from('users')
          .select('*')
          .eq('pin', cleanInput)
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error || !data) return { success: false, error: 'Invalid PIN' };
      
      if (data.role !== 'Admin' && data.role !== 'Manager' && data.role !== 'SuperAdmin') {
        return { success: false, error: 'Access denied. Only Admins and Managers can access the web dashboard.' };
      }
      
      return { success: true, data };
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

  getMenuRecipes: async (sectionId?: number) => {
    const rid = getRestaurantId();
    let query = supabase.from('menu_recipes').select('*').order('item_name');
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
    let query = supabase.from('menu_recipes').select('*').eq('id', id);
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
    const { error } = await supabase.from('menu_recipes').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  deleteMenuRecipe: async (recipeId: string) => {
    // We soft-delete or completely delete depending on business logic. The mobile app does soft-delete.
    const { error } = await supabase.from('menu_recipes').update({ is_active: false }).eq('id', recipeId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Branches, Departments and Users for Access Control Dropdowns
  getBranchesList: async () => {
    const rid = getRestaurantId();
    let query = supabase.from('branches').select('*').order('name');
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
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

  getUserById: async (id: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('users').select('*').eq('id', id);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveUser: async (user: any) => {
    const payload = await injectRestaurantId({ ...user });
    let res;
    if (payload.id) {
      res = await supabase.from('users').update(payload).eq('id', payload.id).select().single();
    } else {
      res = await supabase.from('users').insert(payload).select().single();
    }
    if (res.error) return { success: false, error: res.error.message };
    return { success: true, data: res.data };
  },

  deleteUser: async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
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
    let query = supabase.from('employees').select('*').eq('branch', branch).in('status', ['Active']);
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  createTipsCollection: async (collection: any, distribution: any[]) => {
    // 1. Insert collection
    const payload = await injectRestaurantId({ ...collection });
    const { data: colData, error: colError } = await supabase.from('tips_collections').insert(payload).select().single();
    if (colError) return { success: false, error: colError.message };

    // 2. Insert distribution with the new collection ID
    const rid = colData.restaurant_id || getRestaurantId();
    const distData = distribution.map(d => ({ 
      ...d, 
      tips_collection_id: colData.id,
      ...(rid ? { restaurant_id: rid } : {})
    }));
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
    const distData = distribution.map(d => ({ 
      ...d, 
      tips_collection_id: collectionId,
      ...(rid ? { restaurant_id: rid } : {})
    }));
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
    return { success: true, data };
  },

  saveAppPermission: async (payload: any) => {
    const { error } = await supabase.from('app_permissions').upsert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
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
  getAppPermissions: async (userName: string, departments: string, userRole: string) => {
    if (userRole === 'Admin' || userRole === 'SuperAdmin') {
      return {
        success: true,
        data: {
          can_create_orders: true, can_send_orders: true,
          can_receive_orders: true, can_edit_all_orders: true,
          can_add_items_to_orders: true, can_order_all_departments: true,
          can_create_purchasing: true, can_order_purchasing: true, can_receive_purchasing: true,
          can_manage_checklists: true, can_fill_checklists: true,
          can_log_waste: true, can_view_waste_report: true,
          can_manage_hr: true, can_manage_training: true, can_manage_reservations: true,
          can_access_settings: true, can_manage_daily_cash: true, can_manage_tips: true,
          can_punch_clock: true,
          can_view_menu_manual: true, can_view_finance_dashboard: true,
          can_view_86: true, can_manage_86: true,
          can_view_complaints: true, can_manage_complaints: true,
          can_view_upsell: true, can_manage_upsell: true,
          can_view_signin_logs: true,
          can_manage_tasks: true,
          can_view_voids: true,
          can_manage_voids: true,
          can_view_client_orders: true,
          can_manage_client_orders: true,
          can_view_client_reports: true,
          can_view_catalog: true,
          can_manage_catalog: true,
          can_view_suppliers: true,
          can_manage_suppliers: true,
          can_view_price_intelligence: true,
          can_manage_price_intelligence: true
        }
      };
    }

    // 1. Try user-specific permissions
    const { data: userData } = await supabase.from('app_permissions').select('*').eq('id', `user:${userName}`).single();
    if (userData) {
      return { success: true, data: userData };
    }

    // 2. Fallback to departments
    const deptList = departments.split(',').map((d: string) => d.trim()).filter(Boolean);
    if (deptList.length > 0) {
      const deptIds = deptList.map((d: string) => `dept:${d}`);
      const { data: deptData } = await supabase.from('app_permissions').select('*').in('id', deptIds);
      
      if (deptData && deptData.length > 0) {
        const merged = deptData.reduce((acc: any, curr: any) => ({
          can_create_orders: acc.can_create_orders || curr.can_create_orders,
          can_send_orders: acc.can_send_orders || curr.can_send_orders,
          can_receive_orders: acc.can_receive_orders || curr.can_receive_orders,
          can_edit_all_orders: acc.can_edit_all_orders || curr.can_edit_all_orders,
          can_add_items_to_orders: acc.can_add_items_to_orders || curr.can_add_items_to_orders,
          can_order_all_departments: acc.can_order_all_departments || curr.can_order_all_departments,
          can_create_purchasing: acc.can_create_purchasing || curr.can_create_purchasing,
          can_order_purchasing: acc.can_order_purchasing || curr.can_order_purchasing,
          can_receive_purchasing: acc.can_receive_purchasing || curr.can_receive_purchasing,
          can_manage_checklists: acc.can_manage_checklists || curr.can_manage_checklists,
          can_fill_checklists: acc.can_fill_checklists || curr.can_fill_checklists,
          can_log_waste: acc.can_log_waste || curr.can_log_waste,
          can_view_waste_report: acc.can_view_waste_report || curr.can_view_waste_report,
          can_manage_hr: acc.can_manage_hr || curr.can_manage_hr,
          can_manage_training: acc.can_manage_training || curr.can_manage_training,
          can_punch_clock: acc.can_punch_clock || curr.can_punch_clock,
          can_manage_reservations: acc.can_manage_reservations || curr.can_manage_reservations,
          can_access_settings: acc.can_access_settings || curr.can_access_settings,
          can_manage_daily_cash: acc.can_manage_daily_cash || curr.can_manage_daily_cash,
          can_manage_tips: acc.can_manage_tips || curr.can_manage_tips,
          can_view_menu_manual: acc.can_view_menu_manual || curr.can_view_menu_manual,
          can_view_finance_dashboard: acc.can_view_finance_dashboard || curr.can_view_finance_dashboard,
          can_view_86: acc.can_view_86 || curr.can_view_86,
          can_manage_86: acc.can_manage_86 || curr.can_manage_86,
          can_view_complaints: acc.can_view_complaints || curr.can_view_complaints,
          can_manage_complaints: acc.can_manage_complaints || curr.can_manage_complaints,
          can_manage_upsell: acc.can_manage_upsell || curr.can_manage_upsell,
          can_view_signin_logs: acc.can_view_signin_logs || curr.can_view_signin_logs,
          can_manage_tasks: acc.can_manage_tasks || curr.can_manage_tasks,
          can_view_voids: acc.can_view_voids || curr.can_view_voids,
          can_manage_voids: acc.can_manage_voids || curr.can_manage_voids,
          can_view_client_orders: acc.can_view_client_orders || curr.can_view_client_orders,
          can_manage_client_orders: acc.can_manage_client_orders || curr.can_manage_client_orders,
          can_view_client_reports: acc.can_view_client_reports || curr.can_view_client_reports,
          can_view_catalog: acc.can_view_catalog || curr.can_view_catalog,
          can_manage_catalog: acc.can_manage_catalog || curr.can_manage_catalog,
          can_view_suppliers: acc.can_view_suppliers || curr.can_view_suppliers,
          can_manage_suppliers: acc.can_manage_suppliers || curr.can_manage_suppliers,
          can_view_price_intelligence: acc.can_view_price_intelligence || curr.can_view_price_intelligence,
          can_manage_price_intelligence: acc.can_manage_price_intelligence || curr.can_manage_price_intelligence
        }), { 
          can_create_orders: false, can_send_orders: false, 
          can_receive_orders: false, can_edit_all_orders: false, 
          can_add_items_to_orders: false, can_order_all_departments: false,
          can_create_purchasing: false, can_order_purchasing: false, can_receive_purchasing: false,
          can_manage_checklists: false, can_fill_checklists: false,
          can_log_waste: false, can_view_waste_report: false,
          can_manage_hr: false, can_manage_training: false, can_manage_reservations: false,
          can_access_settings: false, can_manage_daily_cash: false, can_manage_tips: false,
          can_punch_clock: false,
          can_view_menu_manual: false, can_view_finance_dashboard: false,
          can_view_86: false, can_manage_86: false,
          can_view_complaints: false, can_manage_complaints: false,
          can_view_upsell: false, can_manage_upsell: false,
          can_view_signin_logs: false,
          can_manage_tasks: false,
          can_view_voids: false,
          can_manage_voids: false,
          can_view_client_orders: false,
          can_manage_client_orders: false,
          can_view_client_reports: false,
          can_view_catalog: false,
          can_manage_catalog: false,
          can_view_suppliers: false,
          can_manage_suppliers: false,
          can_view_price_intelligence: false,
          can_manage_price_intelligence: false
        });
        return { success: true, data: merged };
      }
    }

    // 3. Default Manager permissions
    if (userRole === 'Manager') {
      return {
        success: true,
        data: {
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
          can_manage_price_intelligence: true
        }
      };
    }

        return { success: true, data: { can_view_complaints: true, can_manage_complaints: true, can_view_voids: true, can_manage_voids: true, can_punch_clock: false } };
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
    
    let fallbackData: any[] = [];
    // Direct REST fetch fallback using explicit Bearer anon token if RLS session restricted rows
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('select', '*');
      urlParams.append('order', 'date.desc');
      if (filters.branch && filters.branch !== 'All') {
        urlParams.append('branch', `ilike.*${filters.branch.trim()}*`);
      }
      if (filters.startDate) {
        urlParams.append('date', `gte.${filters.startDate.split('T')[0].split(' ')[0]}`);
      }
      if (filters.endDate) {
        const endClean = filters.endDate.split('T')[0].split(' ')[0];
        const parts = endClean.split('-');
        if (parts.length === 3) {
          const nextDayStr = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + 1)).toISOString().split('T')[0];
          urlParams.append('date', `lt.${nextDayStr}`);
        }
      }
      if (rid) {
        urlParams.append('restaurant_id', `eq.${rid}`);
      }
      const rawRes = await fetch(`https://ibtbcgkkixkglnhhrrpu.supabase.co/rest/v1/shift_cash?${urlParams.toString()}`, {
        headers: {
          'apikey': 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm',
          'Authorization': 'Bearer sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm',
          'Content-Type': 'application/json'
        }
      });
      if (rawRes.ok) {
        const rawData = await rawRes.json();
        if (Array.isArray(rawData)) {
          fallbackData = rawData;
        }
      }
    } catch (e) {
      console.warn('Fallback shift fetch failed:', e);
    }

    const mergedMap = new Map<string, any>();
    if (primaryData) {
      primaryData.forEach((item: any) => mergedMap.set(item.id, item));
    }
    fallbackData.forEach((item: any) => {
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    });

    const mergedList = Array.from(mergedMap.values());
    mergedList.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // desc
      }
      const createA = a.created_at || '';
      const createB = b.created_at || '';
      return createB.localeCompare(createA); // desc
    });

    if (error && mergedList.length === 0) return { success: false, error: error.message };
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

    let fallbackData: any[] = [];
    // Direct REST fetch fallback
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('select', '*');
      urlParams.append('order', 'date.desc,created_at.desc');
      if (filters.branch && filters.branch !== 'All') {
        urlParams.append('branch', `ilike.*${filters.branch.trim()}*`);
      }
      if (filters.startDate) {
        urlParams.append('date', `gte.${filters.startDate.split('T')[0].split(' ')[0]}`);
      }
      if (filters.endDate) {
        const endClean = filters.endDate.split('T')[0].split(' ')[0];
        const parts = endClean.split('-');
        if (parts.length === 3) {
          const nextDayStr = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + 1)).toISOString().split('T')[0];
          urlParams.append('date', `lt.${nextDayStr}`);
        }
      }
      if (rid) {
        urlParams.append('restaurant_id', `eq.${rid}`);
      }
      const rawRes = await fetch(`https://ibtbcgkkixkglnhhrrpu.supabase.co/rest/v1/daily_payments?${urlParams.toString()}`, {
        headers: {
          'apikey': 'sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm',
          'Authorization': 'Bearer sb_publishable_D4nQcvqUIxlRDDoMy_LDrg_18m5RIhm',
          'Content-Type': 'application/json'
        }
      });
      if (rawRes.ok) {
        const rawData = await rawRes.json();
        if (Array.isArray(rawData)) {
          fallbackData = rawData;
        }
      }
    } catch (e) {
      console.warn('Fallback payment fetch failed:', e);
    }

    const mergedMap = new Map<string, any>();
    if (primaryData) {
      primaryData.forEach((item: any) => mergedMap.set(item.id, item));
    }
    fallbackData.forEach((item: any) => {
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    });

    const mergedList = Array.from(mergedMap.values());
    mergedList.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // desc
      }
      const createA = a.created_at || '';
      const createB = b.created_at || '';
      return createB.localeCompare(createA); // desc
    });

    if (error && mergedList.length === 0) return { success: false, error: error.message };
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
  get86Logs: async (date: string, branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('menu_86').select('*').eq('date', date);
    if (branch && branch !== 'All') {
      query = query.eq('branch', branch);
    }
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    const { data, error } = await query.order('branch');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  save86: async (branch: string, items: any[], date: string) => {
    const { data: existing, error: findError } = await supabase
      .from('menu_86')
      .select('id')
      .eq('branch', branch)
      .eq('date', date)
      .maybeSingle();

    if (findError) return { success: false, error: findError.message };

    if (existing) {
      const { error } = await supabase
        .from('menu_86')
        .update({ items })
        .eq('id', existing.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from('menu_86')
        .insert([{ branch, date, items }]);
      if (error) return { success: false, error: error.message };
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
    let query = supabase.from('items').select('*').eq('purchasing', 'yes').order('name');
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
    const { error } = await supabase.from('branches').delete().eq('name', name);
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

  getReservations: async (branch: string, date: string) => {
    const rid = getRestaurantId();
    let resQuery = supabase
      .from('reservations')
      .select('*')
      .eq('branch', branch)
      .eq('reservation_date', date);
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
    let query = supabase.from('items').select('*').order('name');
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

  deleteCatalogItem: async (id: string) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
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
      const itemsPayload = items.map((item: any) => ({ ...item, order_id: order.id }));
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
    let { data, error } = await supabase
      .from('users')
      .select('id, name, email, pin')
      .eq('restaurant_id', restaurantId)
      .order('id', { ascending: true })
      .limit(1);

    if (error && (error.message.includes('restaurant_id') || error.message.includes('relationship'))) {
      // Fallback: get the first Admin/Manager user or just the first user
      const fallback = await supabase
        .from('users')
        .select('id, name, email, pin')
        .in('role', ['Admin', 'Manager'])
        .order('id', { ascending: true })
        .limit(1);
      data = fallback.data;
      error = fallback.error;
    }

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

    if (payload.admin_email || payload.admin_name || payload.admin_pin) {
      const updateData: any = {};
      if (payload.admin_name) updateData.name = payload.admin_name;
      if (payload.admin_email) updateData.email = payload.admin_email.toLowerCase();
      if (payload.admin_pin) updateData.pin = payload.admin_pin;

      let userErr: any = null;
      if (payload.admin_id) {
        const res = await supabase
          .from('users')
          .update(updateData)
          .eq('id', payload.admin_id);
        userErr = res.error;
      } else {
        const res = await supabase
          .from('users')
          .update(updateData)
          .eq('restaurant_id', id);
        userErr = res.error;

        if (userErr && (userErr.message.includes('restaurant_id') || userErr.message.includes('relationship'))) {
          // Fallback for single-tenant databases: update the first Admin/Manager user
          const { data: firstAdmin } = await supabase
            .from('users')
            .select('id')
            .in('role', ['Admin', 'Manager'])
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (firstAdmin) {
            const res2 = await supabase
              .from('users')
              .update(updateData)
              .eq('id', firstAdmin.id);
            userErr = res2.error;
          }
        }
      }

      if (userErr) return { success: false, error: userErr.message };
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
    if (rid) query = query.eq('restaurant_id', rid);
    const { data, error } = await query.order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveInventoryLocation: async (location: { id?: string, name: string }) => {
    const payload = await injectRestaurantId({ ...location });
    const { error } = await supabase.from('inventory_locations').upsert(payload);
    if (error) return { success: false, error: error.message };
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
    return { success: true, data };
  },

  saveAttendanceLog: async (log: any) => {
    let res;
    if (log.id) {
      res = await supabase.from('employee_attendance').update(log).eq('id', log.id);
    } else {
      res = await supabase.from('employee_attendance').insert([log]);
    }
    if (res.error) return { success: false, error: res.error.message };
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
};

