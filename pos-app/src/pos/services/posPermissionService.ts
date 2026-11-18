// FLOW POS — Permission Service & Precedence Engine
import { supabase } from '../../api/supabase';

export type PosPermissionKey =
  // A. Table Management
  | 'view_floor'
  | 'view_all_tables'
  | 'open_table'
  | 'edit_own_table'
  | 'view_other_tables'
  | 'add_items_to_other_tables'
  | 'edit_other_tables'
  | 'transfer_table'
  | 'move_table'
  | 'merge_tables'
  | 'split_table_check'
  | 'settle_table'
  | 'close_table'
  | 'reopen_table'
  // B. Order Management
  | 'create_order'
  | 'add_items'
  | 'edit_unsent_items'
  | 'delete_unsent_items'
  | 'send_to_kitchen'
  | 'void_sent_items'
  | 'change_quantity'
  | 'change_item_price'
  | 'apply_discount'
  | 'complimentary_items'
  | 'cancel_entire_order'
  | 'reprint_kitchen_ticket'
  // C. Payments & Cash Control
  | 'view_bill'
  | 'print_bill'
  | 'collect_payment'
  | 'accept_cash'
  | 'accept_card'
  | 'split_payment'
  | 'change_payment_method'
  | 'refund_payment'
  | 'reopen_paid_check'
  | 'view_own_sales'
  | 'view_all_sales'
  | 'access_cash_drawer'
  | 'cash_adjustment'
  // D. Supervisor & Administrative Controls
  | 'authorize_restricted_action'
  | 'override_order_restrictions'
  | 'manage_pos_permissions'
  | 'view_pos_audit_log'
  | 'configure_pos_settings'
  | 'manage_pos_devices'
  | 'access_features'
  // E. Multi-Concept Controls
  | 'switch_pos_concept'
  | 'view_all_concepts'
  | 'view_concept_sales'
  | 'view_concept_costs'
  | 'view_concept_profitability';

export type PosRoleName =
  | 'waiter'
  | 'runner'
  | 'cashier'
  | 'floor_supervisor'
  | 'manager'
  | 'administrator';

export type PermissionOverrideState = 'inherit' | 'allow' | 'deny';

export const DEFAULT_ROLE_PERMISSIONS: Record<PosRoleName, Record<PosPermissionKey, boolean>> = {
  waiter: {
    view_floor: true,
    view_all_tables: true,
    open_table: true,
    edit_own_table: true,
    view_other_tables: true,
    add_items_to_other_tables: true,
    edit_other_tables: false,
    transfer_table: false,
    move_table: false,
    merge_tables: false,
    split_table_check: false,
    settle_table: false,
    close_table: false,
    reopen_table: false,

    create_order: true,
    add_items: true,
    edit_unsent_items: true,
    delete_unsent_items: true,
    send_to_kitchen: true,
    void_sent_items: false,
    change_quantity: true,
    change_item_price: false,
    apply_discount: false,
    complimentary_items: false,
    cancel_entire_order: false,
    reprint_kitchen_ticket: false,

    view_bill: true,
    print_bill: true,
    collect_payment: false,
    accept_cash: false,
    accept_card: false,
    split_payment: false,
    change_payment_method: false,
    refund_payment: false,
    reopen_paid_check: false,
    view_own_sales: true,
    view_all_sales: false,
    access_cash_drawer: false,
    cash_adjustment: false,

    authorize_restricted_action: false,
    override_order_restrictions: false,
    manage_pos_permissions: false,
    view_pos_audit_log: false,
    configure_pos_settings: false,
    manage_pos_devices: false,
    access_features: false,
    switch_pos_concept: false,
    view_all_concepts: false,
    view_concept_sales: false,
    view_concept_costs: false,
    view_concept_profitability: false
  },

  runner: {
    view_floor: true,
    view_all_tables: true,
    open_table: false,
    edit_own_table: false,
    view_other_tables: true,
    add_items_to_other_tables: false,
    edit_other_tables: false,
    transfer_table: false,
    move_table: false,
    merge_tables: false,
    split_table_check: false,
    settle_table: false,
    close_table: false,
    reopen_table: false,

    create_order: false,
    add_items: false,
    edit_unsent_items: false,
    delete_unsent_items: false,
    send_to_kitchen: false,
    void_sent_items: false,
    change_quantity: false,
    change_item_price: false,
    apply_discount: false,
    complimentary_items: false,
    cancel_entire_order: false,
    reprint_kitchen_ticket: false,

    view_bill: true,
    print_bill: false,
    collect_payment: false,
    accept_cash: false,
    accept_card: false,
    split_payment: false,
    change_payment_method: false,
    refund_payment: false,
    reopen_paid_check: false,
    view_own_sales: false,
    view_all_sales: false,
    access_cash_drawer: false,
    cash_adjustment: false,

    authorize_restricted_action: false,
    override_order_restrictions: false,
    manage_pos_permissions: false,
    view_pos_audit_log: false,
    configure_pos_settings: false,
    manage_pos_devices: false,
    access_features: false,
    switch_pos_concept: false,
    view_all_concepts: false,
    view_concept_sales: false,
    view_concept_costs: false,
    view_concept_profitability: false
  },

  cashier: {
    view_floor: true,
    view_all_tables: true,
    open_table: true,
    edit_own_table: true,
    view_other_tables: true,
    add_items_to_other_tables: true,
    edit_other_tables: false,
    transfer_table: false,
    move_table: false,
    merge_tables: false,
    split_table_check: true,
    settle_table: true,
    close_table: true,
    reopen_table: false,

    create_order: true,
    add_items: true,
    edit_unsent_items: true,
    delete_unsent_items: true,
    send_to_kitchen: false,
    void_sent_items: false,
    change_quantity: true,
    change_item_price: false,
    apply_discount: false,
    complimentary_items: false,
    cancel_entire_order: false,
    reprint_kitchen_ticket: true,

    view_bill: true,
    print_bill: true,
    collect_payment: true,
    accept_cash: true,
    accept_card: true,
    split_payment: true,
    change_payment_method: true,
    refund_payment: false,
    reopen_paid_check: false,
    view_own_sales: true,
    view_all_sales: true,
    access_cash_drawer: true,
    cash_adjustment: false,

    authorize_restricted_action: false,
    override_order_restrictions: false,
    manage_pos_permissions: false,
    view_pos_audit_log: false,
    configure_pos_settings: false,
    manage_pos_devices: false,
    access_features: true,
    switch_pos_concept: true,
    view_all_concepts: false,
    view_concept_sales: true,
    view_concept_costs: false,
    view_concept_profitability: false
  },

  floor_supervisor: {
    view_floor: true,
    view_all_tables: true,
    open_table: true,
    edit_own_table: true,
    view_other_tables: true,
    add_items_to_other_tables: true,
    edit_other_tables: true,
    transfer_table: true,
    move_table: true,
    merge_tables: true,
    split_table_check: true,
    settle_table: true,
    close_table: true,
    reopen_table: false,

    create_order: true,
    add_items: true,
    edit_unsent_items: true,
    delete_unsent_items: true,
    send_to_kitchen: true,
    void_sent_items: true,
    change_quantity: true,
    change_item_price: false,
    apply_discount: true,
    complimentary_items: false,
    cancel_entire_order: true,
    reprint_kitchen_ticket: true,

    view_bill: true,
    print_bill: true,
    collect_payment: true,
    accept_cash: true,
    accept_card: true,
    split_payment: true,
    change_payment_method: true,
    refund_payment: false,
    reopen_paid_check: false,
    view_own_sales: true,
    view_all_sales: true,
    access_cash_drawer: true,
    cash_adjustment: true,

    authorize_restricted_action: true,
    override_order_restrictions: true,
    manage_pos_permissions: false,
    view_pos_audit_log: true,
    configure_pos_settings: false,
    manage_pos_devices: false,
    access_features: true,
    switch_pos_concept: true,
    view_all_concepts: true,
    view_concept_sales: true,
    view_concept_costs: false,
    view_concept_profitability: false
  },

  manager: {
    view_floor: true,
    view_all_tables: true,
    open_table: true,
    edit_own_table: true,
    view_other_tables: true,
    add_items_to_other_tables: true,
    edit_other_tables: true,
    transfer_table: true,
    move_table: true,
    merge_tables: true,
    split_table_check: true,
    settle_table: true,
    close_table: true,
    reopen_table: true,

    create_order: true,
    add_items: true,
    edit_unsent_items: true,
    delete_unsent_items: true,
    send_to_kitchen: true,
    void_sent_items: true,
    change_quantity: true,
    change_item_price: true,
    apply_discount: true,
    complimentary_items: true,
    cancel_entire_order: true,
    reprint_kitchen_ticket: true,

    view_bill: true,
    print_bill: true,
    collect_payment: true,
    accept_cash: true,
    accept_card: true,
    split_payment: true,
    change_payment_method: true,
    refund_payment: true,
    reopen_paid_check: true,
    view_own_sales: true,
    view_all_sales: true,
    access_cash_drawer: true,
    cash_adjustment: true,

    authorize_restricted_action: true,
    override_order_restrictions: true,
    manage_pos_permissions: false,
    view_pos_audit_log: true,
    configure_pos_settings: true,
    manage_pos_devices: true,
    access_features: true,
    switch_pos_concept: true,
    view_all_concepts: true,
    view_concept_sales: true,
    view_concept_costs: true,
    view_concept_profitability: true
  },

  administrator: {
    view_floor: true,
    view_all_tables: true,
    open_table: true,
    edit_own_table: true,
    view_other_tables: true,
    add_items_to_other_tables: true,
    edit_other_tables: true,
    transfer_table: true,
    move_table: true,
    merge_tables: true,
    split_table_check: true,
    settle_table: true,
    close_table: true,
    reopen_table: true,

    create_order: true,
    add_items: true,
    edit_unsent_items: true,
    delete_unsent_items: true,
    send_to_kitchen: true,
    void_sent_items: true,
    change_quantity: true,
    change_item_price: true,
    apply_discount: true,
    complimentary_items: true,
    cancel_entire_order: true,
    reprint_kitchen_ticket: true,

    view_bill: true,
    print_bill: true,
    collect_payment: true,
    accept_cash: true,
    accept_card: true,
    split_payment: true,
    change_payment_method: true,
    refund_payment: true,
    reopen_paid_check: true,
    view_own_sales: true,
    view_all_sales: true,
    access_cash_drawer: true,
    cash_adjustment: true,

    authorize_restricted_action: true,
    override_order_restrictions: true,
    manage_pos_permissions: true,
    view_pos_audit_log: true,
    configure_pos_settings: true,
    manage_pos_devices: true,
    access_features: true,
    switch_pos_concept: true,
    view_all_concepts: true,
    view_concept_sales: true,
    view_concept_costs: true,
    view_concept_profitability: true
  }
};

export function normalizePosRole(roleStr?: string | null): PosRoleName {
  if (!roleStr) return 'waiter';
  const clean = roleStr.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (clean.includes('admin') || clean.includes('owner')) return 'administrator';
  if (clean.includes('manager') || clean.includes('gm') || clean.includes('incharge')) return 'manager';
  if (clean.includes('supervisor') || clean.includes('lead') || clean.includes('captain') || clean.includes('headwaiter')) return 'floor_supervisor';
  if (clean.includes('cashier') || clean.includes('cash') || clean.includes('billing') || clean === 'user' || clean === 'staff' || clean === 'pos' || clean === 'operator') return 'cashier';
  if (clean.includes('runner') || clean.includes('busser') || clean.includes('barback') || clean.includes('commis')) return 'runner';
  if (clean.includes('waiter') || clean.includes('waitress') || clean.includes('server') || clean.includes('steward')) return 'waiter';
  return 'waiter';
}

// ── In-Memory Role Cache to avoid repetitive network calls ──
let cachedRoleTemplates: Partial<Record<PosRoleName, Record<PosPermissionKey, boolean>>> | null = null;
let cachedRestaurantId: string | null = null;

export async function fetchPosRoleTemplates(restaurantId: string): Promise<Record<PosRoleName, Record<PosPermissionKey, boolean>>> {
  if (cachedRoleTemplates && cachedRestaurantId === restaurantId) {
    return { ...DEFAULT_ROLE_PERMISSIONS, ...cachedRoleTemplates };
  }

  try {
    const { data } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .maybeSingle();

    if (data?.settings?.pos_role_permissions) {
      cachedRoleTemplates = data.settings.pos_role_permissions;
      cachedRestaurantId = restaurantId;
      return { ...DEFAULT_ROLE_PERMISSIONS, ...cachedRoleTemplates };
    }
  } catch (err) {
    console.warn('Failed to fetch role templates from DB, using defaults:', err);
  }

  return DEFAULT_ROLE_PERMISSIONS;
}

export const loadRestaurantRolePermissions = fetchPosRoleTemplates;

/**
 * Resolves whether a user has POS Terminal Access Enabled.
 * Default is FALSE unless explicitly enabled on user or app_permissions.
 */
export function checkHasPosTerminalAccess(user: any, appPermissions: any[] = []): boolean {
  if (!user || user.is_active === false) return false;

  // 1. Check explicit denial on user object
  if (
    user.permissions?.can_access_pos === false ||
    user.admin_permissions?.can_access_pos === false ||
    user.can_access_pos === false
  ) {
    return false;
  }

  // 2. Build normalized identifiers for this user
  const userKeys = new Set<string>();
  if (user.id) {
    userKeys.add(`user:${user.id}`.toLowerCase());
    userKeys.add(`admin_user:${user.id}`.toLowerCase());
    userKeys.add(String(user.id).toLowerCase());
  }
  if (user.name) {
    userKeys.add(`user:${user.name}`.toLowerCase());
  }
  if (user.display_name) {
    userKeys.add(`user:${user.display_name}`.toLowerCase());
  }

  const userNameLower = (user.name || '').trim().toLowerCase();
  const userDisplayNameLower = (user.display_name || '').trim().toLowerCase();

  // Find user-specific permissions in app_permissions
  const userSpecificPerms = (appPermissions || []).filter((p: any) => {
    if (!p) return false;
    const pIdLower = (p.id || '').toLowerCase();
    if (userKeys.has(pIdLower)) return true;
    if (p.type === 'user' || p.type === 'admin_user') {
      const pNameLower = (p.name || '').trim().toLowerCase();
      if (userNameLower && pNameLower === userNameLower) return true;
      if (userDisplayNameLower && pNameLower === userDisplayNameLower) return true;
    }
    return false;
  });

  // Check explicit denial in user-specific app_permissions
  for (const p of userSpecificPerms) {
    if (
      p.can_access_pos === false ||
      p.admin_permissions?.can_access_pos === false ||
      p.permissions?.can_access_pos === false
    ) {
      return false;
    }
  }

  // 3. Check explicit grant on user object
  if (
    user.permissions?.can_access_pos === true ||
    user.admin_permissions?.can_access_pos === true ||
    user.can_access_pos === true
  ) {
    return true;
  }

  // 4. Check explicit grant in user-specific app_permissions
  for (const p of userSpecificPerms) {
    if (
      p.can_access_pos === true ||
      p.admin_permissions?.can_access_pos === true ||
      p.permissions?.can_access_pos === true
    ) {
      return true;
    }
  }

  // 5. Check department-level permissions in app_permissions
  const userDepts: string[] = [];
  if (user.department) userDepts.push(user.department);
  if (typeof user.departments === 'string') {
    user.departments.split(',').forEach((d: string) => userDepts.push(d.trim()));
  } else if (Array.isArray(user.departments)) {
    user.departments.forEach((d: any) => userDepts.push(String(d).trim()));
  }

  for (const dept of userDepts) {
    const deptKey = `dept:${dept}`.toLowerCase();
    const deptPerm = (appPermissions || []).find((p: any) => {
      if (!p) return false;
      const pIdLower = (p.id || '').toLowerCase();
      if (pIdLower === deptKey) return true;
      if (p.type === 'department' && (p.name || '').trim().toLowerCase() === dept.toLowerCase()) return true;
      return false;
    });

    if (deptPerm) {
      if (deptPerm.can_access_pos === false || deptPerm.admin_permissions?.can_access_pos === false) {
        return false;
      }
      if (deptPerm.can_access_pos === true || deptPerm.admin_permissions?.can_access_pos === true) {
        return true;
      }
    }
  }

  // Default: if POS Terminal Access is not explicitly enabled, access is false.
  return false;
}

// ── Check if User has permission ──
// 1. Employee-specific override (Allow / Deny)
// 2. Assigned role permission
// 3. Default Deny
export function hasPosPermission(
  user: any,
  permissionKey: PosPermissionKey,
  customRoleTemplates?: Partial<Record<PosRoleName, Record<PosPermissionKey, boolean>>>
): boolean {
  if (!user) return false;

  // SuperAdmin has full access
  const rawRole = (user.role || user.position || '').toLowerCase();
  if (rawRole.includes('superadmin')) return true;

  // Check if POS access is explicitly disabled
  if (user.is_active === false) return false;
  if (
    user.permissions?.can_access_pos === false ||
    user.admin_permissions?.can_access_pos === false ||
    user.can_access_pos === false
  ) {
    return false;
  }

  // 1. Employee-specific override
  const overrides: Partial<Record<PosPermissionKey, PermissionOverrideState>> =
    user.pos_overrides || user.permissions?.pos_overrides || {};

  const override = overrides[permissionKey];
  if (override === 'allow') return true;
  if (override === 'deny') return false;

  // 2. Assigned role permission
  let effectiveRole = user.role || user.position;
  if ((!effectiveRole || effectiveRole.toLowerCase() === 'waiter') && (user.name || '').toLowerCase().includes('cashier')) {
    effectiveRole = 'cashier';
  }
  const normRole = normalizePosRole(effectiveRole);
  const roleConfig = {
    ...DEFAULT_ROLE_PERMISSIONS[normRole],
    ...(customRoleTemplates?.[normRole] || cachedRoleTemplates?.[normRole] || {})
  };

  return !!roleConfig[permissionKey];
}

// ── Verify Supervisor Authorization PIN ──
export async function verifySupervisorPin(
  restaurantId: string,
  pinCode: string,
  requiredPermission: PosPermissionKey
): Promise<{ success: boolean; supervisor?: any; error?: string }> {
  try {
    const cleanPin = pinCode.trim();
    if (!cleanPin || cleanPin.length < 3) {
      return { success: false, error: 'Please enter a valid supervisor PIN.' };
    }

    // Query active users with this PIN for this restaurant
    const { data: users, error: dbErr } = await supabase
      .from('users')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .or(`pin.eq.${cleanPin},pin_code.eq.${cleanPin}`);

    if (dbErr) throw new Error(dbErr.message);

    if (!users || users.length === 0) {
      return { success: false, error: 'Incorrect PIN. No supervisor found with this PIN.' };
    }

    // Check each user to see if they hold supervisor authorization capability
    for (const sup of users) {
      const isAuthorized =
        hasPosPermission(sup, 'authorize_restricted_action') ||
        hasPosPermission(sup, requiredPermission) ||
        ['admin', 'superadmin', 'manager', 'floor_supervisor'].includes((sup.role || '').toLowerCase());

      if (isAuthorized) {
        return {
          success: true,
          supervisor: {
            id: sup.id,
            name: sup.display_name || sup.name,
            role: sup.role
          }
        };
      }
    }

    return { success: false, error: 'PIN verified, but this staff member lacks authorization privileges.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Authorization verification failed.' };
  }
}

// ── Log Sensitive POS Action to Audit Log ──
export async function logSensitivePosAction(payload: {
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
}) {
  try {
    const logDetails = {
      action_label: payload.actionLabel,
      action_type: payload.actionType,
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

    await supabase.from('activity_logs').insert({
      restaurant_id: payload.restaurantId,
      user_name: payload.employeeName,
      action: `POS_${payload.actionType.toUpperCase()}`,
      details: JSON.stringify(logDetails)
    });
  } catch (err) {
    console.warn('Failed to record POS audit log:', err);
  }
}
