// FLOW POS — Permissions API Client
import { supabase, getRestaurantId } from './supabase';
import {
  DEFAULT_ROLE_PERMISSIONS,
  normalizePosRole,
  resolveEffectivePermissions,
  checkHasPosTerminalAccess,
  type PosRoleName,
  type PosPermissionKey,
  type EmployeePosConfig,
  type PosAuditLogEntry
} from '../pos/posPermissions';

export const posPermissionsApi = {
  // ── Tab 1: Role Permissions Matrix ──
  getPosRolePermissions: async (restaurantId?: string): Promise<{ success: boolean; data?: Record<PosRoleName, Record<PosPermissionKey, boolean>>; error?: string }> => {
    const rid = restaurantId || getRestaurantId();
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', rid)
        .maybeSingle();

      if (error) return { success: false, error: error.message };
      const savedRoles = data?.settings?.pos_role_permissions || {};

      const mergedRoles: any = {};
      (Object.keys(DEFAULT_ROLE_PERMISSIONS) as PosRoleName[]).forEach((roleName) => {
        mergedRoles[roleName] = {
          ...DEFAULT_ROLE_PERMISSIONS[roleName],
          ...(savedRoles[roleName] || {})
        };
      });

      return {
        success: true,
        data: mergedRoles
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  savePosRolePermissions: async (
    roles: Record<PosRoleName, Record<PosPermissionKey, boolean>>,
    restaurantId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const rid = restaurantId || getRestaurantId();
    try {
      const { data: current, error: getErr } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', rid)
        .maybeSingle();

      if (getErr) return { success: false, error: getErr.message };

      const updatedSettings = {
        ...(current?.settings || {}),
        pos_role_permissions: roles
      };

      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({ settings: updatedSettings })
        .eq('id', rid);

      if (updateErr) return { success: false, error: updateErr.message };

      // Also sync to app_permissions table for each role as backup/queryability
      try {
        const roleUpserts = (Object.keys(roles) as PosRoleName[]).map((rName) => ({
          id: `pos_role:${rName}`,
          type: 'pos_role',
          name: rName,
          restaurant_id: rid,
          admin_permissions: { pos_permissions: roles[rName] }
        }));
        await supabase.from('app_permissions').upsert(roleUpserts);
      } catch (syncErr) {
        console.warn('Backup app_permissions sync warning:', syncErr);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Tab 2: Employee Permissions & Individual Overrides ──
  getPosEmployees: async (restaurantId?: string): Promise<{ success: boolean; data?: EmployeePosConfig[]; error?: string }> => {
    const rid = restaurantId || getRestaurantId();
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, display_name, role, branch, branch_id, is_active, pin, pin_code, permissions, admin_permissions, departments')
        .eq('restaurant_id', rid)
        .order('name');

      if (error) return { success: false, error: error.message };

      const [rolesRes, appPermsRes] = await Promise.all([
        posPermissionsApi.getPosRolePermissions(rid),
        supabase.from('app_permissions').select('*')
      ]);

      const roleTemplates = rolesRes.success && rolesRes.data ? rolesRes.data : DEFAULT_ROLE_PERMISSIONS;
      const appPerms = appPermsRes.data || [];

      const normalized: EmployeePosConfig[] = (users || []).map((u: any) => {
        const overrides = u.permissions?.pos_overrides || u.admin_permissions?.pos_overrides || {};
        const canAccessPos = checkHasPosTerminalAccess(u, appPerms);
        const normRole = normalizePosRole(u.role);
        const effective = resolveEffectivePermissions(u.role, overrides, roleTemplates);

        return {
          user_id: u.id,
          name: u.display_name || u.name,
          display_name: u.display_name,
          role: u.role || 'Staff',
          normalized_role: normRole,
          branch: u.branch || 'All',
          is_active: u.is_active !== false,
          can_access_pos: canAccessPos,
          overrides,
          pin: u.pin_code || u.pin,
          effective_permissions: effective
        };
      });

      return { success: true, data: normalized };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  savePosEmployeeOverrides: async (
    userId: string,
    overrides: any,
    canAccessPos: boolean,
    userName?: string,
    newRole?: string,
    newBranch?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: user, error: uErr } = await supabase
        .from('users')
        .select('id, name, permissions, admin_permissions, role, branch')
        .eq('id', userId)
        .maybeSingle();

      if (uErr) return { success: false, error: uErr.message };

      const updatedPermissions = {
        ...(user?.permissions || {}),
        can_access_pos: canAccessPos,
        pos_overrides: overrides
      };

      const updatedAdminPermissions = {
        ...(user?.admin_permissions || {}),
        can_access_pos: canAccessPos,
        pos_overrides: overrides
      };

      const updatePayload: any = {
        permissions: updatedPermissions,
        admin_permissions: updatedAdminPermissions
      };

      if (newRole && newRole !== user?.role) {
        updatePayload.role = newRole;
      }
      if (newBranch && newBranch !== user?.branch) {
        updatePayload.branch = newBranch;
      }

      const { error: saveErr } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId);

      if (saveErr) return { success: false, error: saveErr.message };

      // Sync to app_permissions as well
      const targetName = userName || user?.name;
      if (targetName) {
        await supabase
          .from('app_permissions')
          .upsert({
            id: `user:${targetName}`,
            type: 'user',
            name: targetName,
            can_access_pos: canAccessPos,
            admin_permissions: updatedAdminPermissions
          });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Tab 3: Authorization & Audit Logs ──
  getPosAuditLogs: async (
    restaurantId?: string,
    filters?: {
      employeeName?: string;
      authorizerName?: string;
      branch?: string;
      actionType?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ success: boolean; data?: PosAuditLogEntry[]; error?: string }> => {
    const rid = restaurantId || getRestaurantId();
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('restaurant_id', rid)
        .ilike('action', 'POS_%')
        .order('created_at', { ascending: false })
        .limit(250);

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };

      let parsed: PosAuditLogEntry[] = (data || []).map((row: any) => {
        let detailsObj: any = {};
        try {
          detailsObj = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
        } catch {
          detailsObj = { raw: row.details };
        }

        return {
          id: row.id,
          created_at: detailsObj.timestamp || row.created_at,
          employee_id: detailsObj.employee_id || '',
          employee_name: detailsObj.employee_name || row.user_name || 'Staff',
          authorizer_id: detailsObj.authorizer_id || null,
          authorizer_name: detailsObj.authorizer_name || null,
          branch: detailsObj.branch || 'Main',
          table_number: detailsObj.table_number || null,
          order_id: detailsObj.order_id || null,
          action_type: detailsObj.action_type || row.action.replace('POS_', '').toLowerCase(),
          action_label: detailsObj.action_label || row.action.replace('POS_', '').replace(/_/g, ' '),
          previous_value: detailsObj.previous_value,
          new_value: detailsObj.new_value,
          reason: detailsObj.reason || null,
          status: detailsObj.status || (detailsObj.authorizer_name ? 'approved' : 'direct'),
          restaurant_id: row.restaurant_id
        };
      });

      if (filters) {
        if (filters.employeeName) {
          parsed = parsed.filter(l => l.employee_name.toLowerCase().includes(filters.employeeName!.toLowerCase()));
        }
        if (filters.authorizerName) {
          parsed = parsed.filter(l => l.authorizer_name?.toLowerCase().includes(filters.authorizerName!.toLowerCase()));
        }
        if (filters.branch && filters.branch !== 'All') {
          parsed = parsed.filter(l => l.branch === filters.branch);
        }
        if (filters.actionType && filters.actionType !== 'all') {
          parsed = parsed.filter(l => l.action_type === filters.actionType);
        }
        if (filters.dateFrom) {
          parsed = parsed.filter(l => l.created_at >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          parsed = parsed.filter(l => l.created_at <= filters.dateTo! + 'T23:59:59Z');
        }
      }

      return { success: true, data: parsed };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  logPosAuditAction: async (payload: {
    restaurantId: string;
    employeeId: string;
    employeeName: string;
    authorizerId?: string | null;
    authorizerName?: string | null;
    branch?: string;
    tableNumber?: string | null;
    orderId?: string | number | null;
    actionType: string;
    actionLabel: string;
    previousValue?: any;
    newValue?: any;
    reason?: string | null;
    status?: 'approved' | 'rejected' | 'direct';
  }) => {
    try {
      const details = {
        action_type: payload.actionType,
        action_label: payload.actionLabel,
        employee_id: payload.employeeId,
        employee_name: payload.employeeName,
        authorizer_id: payload.authorizerId || null,
        authorizer_name: payload.authorizerName || null,
        branch: payload.branch || 'Main',
        table_number: payload.tableNumber || null,
        order_id: payload.orderId || null,
        previous_value: payload.previousValue,
        new_value: payload.newValue,
        reason: payload.reason || null,
        status: payload.status || (payload.authorizerId ? 'approved' : 'direct'),
        timestamp: new Date().toISOString()
      };

      const { data, error } = await supabase.from('activity_logs').insert({
        restaurant_id: payload.restaurantId,
        user_name: payload.employeeName,
        action: `POS_${payload.actionType.toUpperCase()}`,
        details: JSON.stringify(details)
      }).select();

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
