import { supabase } from './supabase';

export const api = {
  // Authentication
  login: async (pin: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('pin', pin)
      .single();
      
    if (error || !data) return { success: false, error: 'Invalid PIN' };
    
    // Check if user is Admin or Manager
    if (data.role !== 'Admin' && data.role !== 'Manager') {
      return { success: false, error: 'Access denied. Only Admins and Managers can access the web dashboard.' };
    }
    
    return { success: true, data };
  },

  // Menu Manual
  getMenuSections: async () => {
    const { data, error } = await supabase.from('menu_sections').select('*').order('display_order');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getMenuRecipes: async (sectionId?: number) => {
    let query = supabase.from('menu_recipes').select('*, menu_sections(name)').order('item_name');
    if (sectionId) query = query.eq('section_id', sectionId);
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getMenuRecipeById: async (id: string) => {
    const { data, error } = await supabase
      .from('menu_recipes')
      .select('*, menu_sections(name)')
      .eq('id', id)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveMenuRecipe: async (recipe: any) => {
    const { error } = await supabase.from('menu_recipes').upsert(recipe);
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
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getDepartmentsList: async () => {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getAllUsers: async () => {
    const { data, error } = await supabase.from('users').select('*').order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // HR & Employees
  getEmployees: async () => {
    const { data, error } = await supabase.from('employees').select('*').order('first_name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  getEmployeeById: async (id: string) => {
    const { data, error } = await supabase.from('employees').select('*').eq('employee_id', id).single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveEmployee: async (employee: any) => {
    let res;
    if (employee.employee_id) {
      res = await supabase.from('employees').update(employee).eq('employee_id', employee.employee_id);
    } else {
      res = await supabase.from('employees').insert(employee);
    }
    if (res.error) return { success: false, error: res.error.message };
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
    let query = supabase.from('tips_settings').select('*');
    if (branch) query = query.eq('branch', branch);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  saveTipsSettings: async (settings: any) => {
    const { error } = await supabase.from('tips_settings').upsert(settings, { onConflict: 'branch' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getEmployeesForTips: async (branch: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('branch', branch)
      .in('status', ['Active']);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  createTipsCollection: async (collection: any, distribution: any[]) => {
    // 1. Insert collection
    const { data: colData, error: colError } = await supabase.from('tips_collections').insert(collection).select().single();
    if (colError) return { success: false, error: colError.message };

    // 2. Insert distribution with the new collection ID
    const distData = distribution.map(d => ({ ...d, tips_collection_id: colData.id }));
    const { error: distError } = await supabase.from('tips_distribution').insert(distData);
    if (distError) {
      // rollback collection if distribution fails
      await supabase.from('tips_collections').delete().eq('id', colData.id);
      return { success: false, error: distError.message };
    }

    return { success: true, data: colData };
  },

  updateTipsCollectionAndDistribution: async (collectionId: string, collectionUpdates: any, distribution: any[]) => {
    const { error: colError } = await supabase.from('tips_collections').update(collectionUpdates).eq('id', collectionId);
    if (colError) return { success: false, error: colError.message };

    // Delete old distribution and insert new
    await supabase.from('tips_distribution').delete().eq('tips_collection_id', collectionId);
    
    const distData = distribution.map(d => ({ ...d, tips_collection_id: collectionId }));
    const { error: distError } = await supabase.from('tips_distribution').insert(distData);
    if (distError) return { success: false, error: distError.message };

    return { success: true };
  },

  getTipsCollections: async (branch?: string, status?: string, department?: string) => {
    let query = supabase.from('tips_collections').select('*').order('created_at', { ascending: false });
    if (branch && branch !== 'All') query = query.eq('branch', branch);
    if (status && status !== 'All') query = query.eq('status', status);
    if (department && department !== 'All') query = query.eq('department', department);
    
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
    const { data, error } = await supabase.from('app_permissions').select('*');
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
    const { data, error } = await supabase.from('training_categories').select('*').order('name');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  addTrainingCategory: async (name: string, description?: string, allowed_roles?: string[]) => {
    const { error } = await supabase.from('training_categories').insert({ 
      name, 
      description,
      allowed_roles: allowed_roles || ['Admin', 'Manager', 'Staff']
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
    let query = supabase.from('training_subcategories').select('*').order('name');
    if (department) query = query.eq('department', department);
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
    let query = supabase.from('training_documents').select('*, training_categories(*)').order('created_at', { ascending: false });
    if (categoryId) query = query.eq('category_id', categoryId);
    if (department && department !== 'All') query = query.eq('department', department);
    
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
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
      
      const { data, error } = await supabase.storage.from('training_media').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (error) return { success: false, error: error.message };
      
      const { data: urlData } = supabase.storage.from('training_media').getPublicUrl(filePath);
      return { success: true, url: urlData.publicUrl };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};
