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
      res = await supabase.from('users').update(payload).eq('id', payload.id).select();
      if (res.error) return { success: false, error: res.error.message };
      if (!res.data || res.data.length === 0) {
        // Fallback: If update didn't find the row, try inserting instead
        res = await supabase.from('users').insert(payload).select();
      }
    } else {
      res = await supabase.from('users').insert(payload).select();
    }
    if (res.error) return { success: false, error: res.error.message };
    
    // Return the first element of the array
    return { success: true, data: res.data && res.data.length > 0 ? res.data[0] : null };
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
    const { error } = await supabase.from('app_permissions').upsert(cleanPayload);
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

    if (userRole === 'Admin' || userRole === 'SuperAdmin') {
      const adminPerms = Object.keys(DEFAULT_PERMISSIONS).reduce((acc: any, key) => {
        acc[key] = key !== 'allowed_departments' ? true : '';
        return acc;
      }, {});
      return { success: true, data: adminPerms };
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
      return !emp || (emp.status !== 'Inactive' && emp.is_active !== false);
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
    let query = supabase.from('inventory_stock_balances').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (location && location !== 'All') query = query.eq('location', location);
    const { data, error } = await query.order('item_name');
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
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
      .from('inventory_count_items')
      .select('*')
      .eq('count_id', countId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  },

  saveStockCount: async (header: any, items: any[]) => {
    const rid = getRestaurantId();
    const countNumber = header.count_number || `STK-${Date.now().toString().slice(-6)}`;
    const payloadHeader = await injectRestaurantId({
      ...header,
      count_number: countNumber
    });

    const { data: countRes, error: countErr } = await supabase
      .from('inventory_counts')
      .insert([payloadHeader])
      .select('id')
      .single();

    if (countErr) return { success: false, error: countErr.message };
    const countId = countRes.id;

    if (items && items.length > 0) {
      // 1. Insert into inventory_count_items
      const payloadItems = items.map(item => ({
        ...item,
        count_id: countId,
        restaurant_id: rid
      }));
      await supabase.from('inventory_count_items').insert(payloadItems);

      // 2. Insert item-level records for existing inventory_counts query compatibility
      const countItemRows = items.map(item => ({
        restaurant_id: rid,
        count_number: countNumber,
        branch: header.branch,
        location: header.location,
        department: item.department || 'General',
        item: item.item_name || item.name,
        item_name: item.item_name || item.name,
        count_qty: Number(item.count_qty || 0),
        expected_qty: Number(item.expected_qty || 0),
        par_level: Number(item.par_level || 0),
        unit: item.unit || 'pcs',
        unit_cost: Number(item.unit_cost || 0),
        variance_qty: Number(item.variance_qty || 0),
        variance_cost: Number(item.variance_cost || 0),
        date: header.date || new Date().toISOString(),
        counted_by: header.counted_by || 'Admin',
        status: header.status || 'Completed'
      }));
      await supabase.from('inventory_counts').insert(countItemRows);

      // Update live stock balances with counted quantities
      for (const item of items) {
        if (item.count_qty !== undefined && item.item_name) {
          const balPayload = await injectRestaurantId({
            branch: header.branch,
            location: header.location,
            item_id: item.item_id || null,
            item_name: item.item_name,
            department: item.department || '',
            unit: item.unit || '',
            par_level: item.par_level || 0,
            current_stock: Number(item.count_qty),
            unit_cost: Number(item.unit_cost || 0),
            last_updated: new Date().toISOString()
          });

          // Check if balance entry exists
          let balQuery = supabase
            .from('inventory_stock_balances')
            .select('id')
            .eq('branch', header.branch)
            .eq('location', header.location)
            .eq('item_name', item.item_name);
          if (rid) balQuery = balQuery.eq('restaurant_id', rid);

          const { data: existingBal } = await balQuery.maybeSingle();
          if (existingBal?.id) {
            await supabase.from('inventory_stock_balances').update({
              current_stock: Number(item.count_qty),
              last_updated: new Date().toISOString()
            }).eq('id', existingBal.id);
          } else {
            await supabase.from('inventory_stock_balances').insert([balPayload]);
          }
        }
      }
    }

    return { success: true, id: countId };
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
    const { error } = await supabase.from('inventory_adjustments').insert([payload]);
    if (error) return { success: false, error: error.message };

    // Update live stock balances
    let balQuery = supabase
      .from('inventory_stock_balances')
      .select('id, current_stock')
      .eq('branch', adjustment.branch)
      .eq('location', adjustment.location)
      .eq('item_name', adjustment.item_name);
    if (rid) balQuery = balQuery.eq('restaurant_id', rid);

    const { data: existingBal } = await balQuery.maybeSingle();
    const isNegative = ['Waste/Damage', 'Internal Use', 'Expiry', 'Stock Out'].includes(adjustment.adjustment_type);
    const qtyDelta = isNegative ? -Math.abs(Number(adjustment.quantity)) : Math.abs(Number(adjustment.quantity));

    if (existingBal?.id) {
      const newStock = Math.max(0, Number(existingBal.current_stock || 0) + qtyDelta);
      await supabase.from('inventory_stock_balances').update({
        current_stock: newStock,
        last_updated: new Date().toISOString()
      }).eq('id', existingBal.id);
    } else {
      const newBalPayload = await injectRestaurantId({
        branch: adjustment.branch,
        location: adjustment.location,
        item_id: adjustment.item_id || null,
        item_name: adjustment.item_name,
        unit: adjustment.unit || '',
        current_stock: Math.max(0, qtyDelta),
        unit_cost: Number(adjustment.unit_cost || 0),
        last_updated: new Date().toISOString()
      });
      await supabase.from('inventory_stock_balances').insert([newBalPayload]);
    }

    return { success: true };
  },

  getStockTransfers: async (branch?: string) => {
    const rid = getRestaurantId();
    let query = supabase.from('inventory_transfers').select('*');
    if (rid) query = query.eq('restaurant_id', rid);
    if (branch && branch !== 'All') {
      query = query.or(`from_branch.eq.${branch},to_branch.eq.${branch}`);
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

  saveStockTransfer: async (header: any, items: any[]) => {
    const rid = getRestaurantId();
    const payloadHeader = await injectRestaurantId({
      ...header,
      transfer_number: header.transfer_number || `TRF-${Date.now().toString().slice(-6)}`
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
        ...item,
        transfer_id: transferId,
        restaurant_id: rid
      }));
      const { error: itemsErr } = await supabase.from('inventory_transfer_items').insert(payloadItems);
      if (itemsErr) return { success: false, error: itemsErr.message };

      // Update source & target stock balances
      for (const item of items) {
        if (item.quantity && item.item_name) {
          const qty = Number(item.quantity);

          // Deduct from source
          let srcQuery = supabase
            .from('inventory_stock_balances')
            .select('id, current_stock')
            .eq('branch', header.from_branch)
            .eq('location', header.from_location)
            .eq('item_name', item.item_name);
          if (rid) srcQuery = srcQuery.eq('restaurant_id', rid);
          const { data: srcBal } = await srcQuery.maybeSingle();

          if (srcBal?.id) {
            await supabase.from('inventory_stock_balances').update({
              current_stock: Math.max(0, Number(srcBal.current_stock || 0) - qty),
              last_updated: new Date().toISOString()
            }).eq('id', srcBal.id);
          }

          // Add to destination
          let destQuery = supabase
            .from('inventory_stock_balances')
            .select('id, current_stock')
            .eq('branch', header.to_branch)
            .eq('location', header.to_location)
            .eq('item_name', item.item_name);
          if (rid) destQuery = destQuery.eq('restaurant_id', rid);
          const { data: destBal } = await destQuery.maybeSingle();

          if (destBal?.id) {
            await supabase.from('inventory_stock_balances').update({
              current_stock: Number(destBal.current_stock || 0) + qty,
              last_updated: new Date().toISOString()
            }).eq('id', destBal.id);
          } else {
            const destPayload = await injectRestaurantId({
              branch: header.to_branch,
              location: header.to_location,
              item_id: item.item_id || null,
              item_name: item.item_name,
              unit: item.unit || '',
              current_stock: qty,
              unit_cost: Number(item.unit_cost || 0),
              last_updated: new Date().toISOString()
            });
            await supabase.from('inventory_stock_balances').insert([destPayload]);
          }
        }
      }
    }

    return { success: true, id: transferId };
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

    const empMap = new Map((empData || []).map((e) => [e.employee_id || e.id, e]));

    const merged = (schedData || []).map((s) => ({
      ...s,
      employees: empMap.get(s.employee_id) || s.employees || null
    })).filter((s) => {
      const emp = s.employees;
      return !emp || (emp.status !== 'Inactive' && emp.is_active !== false);
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

  copyPreviousWeekSchedule: async (sourceStartDate: string, targetStartDate: string, branch?: string) => {
    const rid = getRestaurantId();
    const srcStart = new Date(sourceStartDate);
    const srcEnd = new Date(srcStart);
    srcEnd.setDate(srcEnd.getDate() + 6);

    const srcEndStr = srcEnd.toISOString().split('T')[0];

    let query = supabase.from('employee_schedules').select('*').gte('date', sourceStartDate).lte('date', srcEndStr);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: existingSource, error: fetchErr } = await query;
    if (fetchErr) return { success: false, error: fetchErr.message };
    if (!existingSource || existingSource.length === 0) {
      return { success: false, error: 'No schedules found in the source week to copy.' };
    }

    let empQuery = supabase.from('employees').select('employee_id, status, is_active');
    if (rid) empQuery = empQuery.eq('restaurant_id', rid);
    const { data: empData } = await empQuery;
    const activeEmpIds = new Set(
      (empData || [])
        .filter((e: any) => e.status !== 'Inactive' && e.is_active !== false)
        .map((e: any) => e.employee_id)
    );

    const activeExistingSource = existingSource.filter((s: any) => activeEmpIds.has(s.employee_id));
    if (activeExistingSource.length === 0) {
      return { success: false, error: 'No schedules for active employees found to copy.' };
    }

    const targetStart = new Date(targetStartDate);
    const daysOffset = Math.round((targetStart.getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));

    const copied = await Promise.all(
      activeExistingSource.map(async (item: any) => {
        const origDate = new Date(item.date);
        origDate.setDate(origDate.getDate() + daysOffset);
        const newDateStr = origDate.toISOString().split('T')[0];

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

    const { error: insertErr } = await supabase.from('employee_schedules').insert(copied);
    if (insertErr) return { success: false, error: insertErr.message };

    // Send targeted schedule update notifications to affected employees
    try {
      const targetEmpIds = Array.from(new Set(copied.map((p) => p.employee_id)));
      const notifications = await Promise.all(
        targetEmpIds.map((empId) =>
          injectRestaurantId({
            title: '📅 Schedule Updated',
            message: `Your work schedule for week of ${targetStartDate} has been copied and updated.`,
            type: 'schedule_updated',
            target_user_id: empId,
            is_read: false,
            created_at: new Date().toISOString()
          })
        )
      );
      await supabase.from('notifications').insert(notifications);
    } catch (notifErr) {
      console.error('Error sending copy week notifications:', notifErr);
    }

    return { success: true, count: copied.length };
  },

  copyPreviousMonthSchedule: async (sourceMonthStr: string, targetMonthStr: string, branch?: string) => {
    const rid = getRestaurantId();
    const [sYear, sMonth] = sourceMonthStr.split('-').map(Number);
    const [tYear, tMonth] = targetMonthStr.split('-').map(Number);

    const sStart = `${sourceMonthStr}-01`;
    const sLastDay = new Date(sYear, sMonth, 0).getDate();
    const sEnd = `${sourceMonthStr}-${String(sLastDay).padStart(2, '0')}`;

    let query = supabase.from('employee_schedules').select('*').gte('date', sStart).lte('date', sEnd);
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (rid) query = query.eq('restaurant_id', rid);

    const { data: existingSource, error: fetchErr } = await query;
    if (fetchErr) return { success: false, error: fetchErr.message };
    if (!existingSource || existingSource.length === 0) {
      return { success: false, error: 'No schedules found in the source month to copy.' };
    }

    let empQuery = supabase.from('employees').select('employee_id, status, is_active');
    if (rid) empQuery = empQuery.eq('restaurant_id', rid);
    const { data: empData } = await empQuery;
    const activeEmpIds = new Set(
      (empData || [])
        .filter((e: any) => e.status !== 'Inactive' && e.is_active !== false)
        .map((e: any) => e.employee_id)
    );

    const activeExistingSource = existingSource.filter((s: any) => activeEmpIds.has(s.employee_id));
    if (activeExistingSource.length === 0) {
      return { success: false, error: 'No schedules for active employees found to copy.' };
    }

    const tLastDay = new Date(tYear, tMonth, 0).getDate();

    const copied: any[] = [];
    for (const item of activeExistingSource) {
      const dayNum = parseInt(item.date.split('-')[2], 10);
      if (dayNum <= tLastDay) {
        const newDateStr = `${targetMonthStr}-${String(dayNum).padStart(2, '0')}`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, published_at, ...rest } = item;
        copied.push(
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

    if (!copied.length) return { success: false, error: 'No valid dates mapped.' };

    const { error: insertErr } = await supabase.from('employee_schedules').insert(copied);
    if (insertErr) return { success: false, error: insertErr.message };

    // Send targeted schedule update notifications to affected employees
    try {
      const targetEmpIds = Array.from(new Set(copied.map((p) => p.employee_id)));
      const notifications = await Promise.all(
        targetEmpIds.map((empId) =>
          injectRestaurantId({
            title: '📅 Schedule Updated',
            message: `Your work schedule for month ${targetMonthStr} has been copied and updated.`,
            type: 'schedule_updated',
            target_user_id: empId,
            is_read: false,
            created_at: new Date().toISOString()
          })
        )
      );
      await supabase.from('notifications').insert(notifications);
    } catch (notifErr) {
      console.error('Error sending copy month notifications:', notifErr);
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
  }
};



