// FLOW POS — Permission Definitions, Role Templates, and Precedence Engine

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
  // E. Multi-Concept Controls (Phase 1)
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

export interface PosPermissionDef {
  key: PosPermissionKey;
  label: string;
  description: string;
  category: 'table' | 'order' | 'payment' | 'supervisor';
  isSensitive?: boolean; // Eligible for supervisor PIN override
}

export const POS_PERMISSION_CATEGORIES = [
  { id: 'table', title: 'Table Management', description: 'Floor overview, table orders, ownership & transfers' },
  { id: 'order', title: 'Order Management', description: 'Item creation, modifications, voids, pricing & kitchen orders' },
  { id: 'payment', title: 'Payments & Cash Control', description: 'Settlement, cash drawer, receipts, refunds & sales auditing' },
  { id: 'supervisor', title: 'Supervisor & Admin Controls', description: 'Elevated approvals, device controls & security policies' }
] as const;

export const POS_PERMISSION_DEFINITIONS: PosPermissionDef[] = [
  // ── A. Table Management ──
  { key: 'view_floor', label: 'View Floor', description: 'Access POS floor overview and floor layouts', category: 'table' },
  { key: 'view_all_tables', label: 'View All Tables', description: 'See every occupied and active table across the floor', category: 'table' },
  { key: 'open_table', label: 'Open Table', description: 'Start a new table order and seat guests', category: 'table' },
  { key: 'edit_own_table', label: 'Edit Own Table', description: 'Modify orders on tables assigned to self', category: 'table' },
  { key: 'view_other_tables', label: 'View Other Tables', description: 'Inspect orders assigned to another employee', category: 'table' },
  { key: 'add_items_to_other_tables', label: 'Add Items to Other Tables', description: 'Add products without transferring table ownership', category: 'table' },
  { key: 'edit_other_tables', label: 'Edit Other Tables', description: 'Modify another waiter\'s existing order items', category: 'table', isSensitive: true },
  { key: 'transfer_table', label: 'Transfer Table', description: 'Change the assigned waiter on an active table', category: 'table', isSensitive: true },
  { key: 'move_table', label: 'Move Table', description: 'Move an order between physical floor tables', category: 'table', isSensitive: true },
  { key: 'merge_tables', label: 'Merge Tables', description: 'Merge multiple tables or checks into one', category: 'table', isSensitive: true },
  { key: 'split_table_check', label: 'Split Table / Check', description: 'Divide an order or bill across multiple guests', category: 'table' },
  { key: 'settle_table', label: 'Settle Table', description: 'Collect payment and settle an active table check', category: 'table' },
  { key: 'close_table', label: 'Close Table', description: 'Close and free a table after payment settlement', category: 'table' },
  { key: 'reopen_table', label: 'Reopen Table', description: 'Reopen a closed or settled table order', category: 'table', isSensitive: true },

  // ── B. Order Management ──
  { key: 'create_order', label: 'Create Order', description: 'Create a new POS direct or takeaway order', category: 'order' },
  { key: 'add_items', label: 'Add Items', description: 'Add products and modifiers to an open order', category: 'order' },
  { key: 'edit_unsent_items', label: 'Edit Unsent Items', description: 'Modify item notes, options, and quantities before kitchen fire', category: 'order' },
  { key: 'delete_unsent_items', label: 'Delete Unsent Items', description: 'Remove items that have not yet been sent to kitchen/bar', category: 'order' },
  { key: 'send_to_kitchen', label: 'Send to Kitchen / Bar', description: 'Submit order items for kitchen and bar preparation', category: 'order' },
  { key: 'void_sent_items', label: 'Void Sent Items', description: 'Cancel items that have already been submitted to kitchen', category: 'order', isSensitive: true },
  { key: 'change_quantity', label: 'Change Quantity', description: 'Modify line item quantities on active orders', category: 'order' },
  { key: 'change_item_price', label: 'Change Item Price', description: 'Override product selling price on ticket', category: 'order', isSensitive: true },
  { key: 'apply_discount', label: 'Apply Discount', description: 'Apply authorized promotions or manual percentage discounts', category: 'order', isSensitive: true },
  { key: 'complimentary_items', label: 'Complimentary Items', description: 'Provide products 100% free of charge (on-the-house)', category: 'order', isSensitive: true },
  { key: 'cancel_entire_order', label: 'Cancel Entire Order', description: 'Cancel or void an entire open order', category: 'order', isSensitive: true },
  { key: 'reprint_kitchen_ticket', label: 'Reprint Kitchen Ticket', description: 'Reprint production tickets to kitchen/bar stations', category: 'order' },

  // ── C. Payments & Cash Control ──
  { key: 'view_bill', label: 'View Bill', description: 'Inspect an order\'s payment bill and subtotal breakdown', category: 'payment' },
  { key: 'print_bill', label: 'Print Bill', description: 'Print guest check/bill for table or customer review', category: 'payment' },
  { key: 'collect_payment', label: 'Collect Payment', description: 'Register customer payments and complete sales', category: 'payment' },
  { key: 'accept_cash', label: 'Accept Cash', description: 'Process physical cash payments and calculate change', category: 'payment' },
  { key: 'accept_card', label: 'Accept Card', description: 'Process credit/debit card terminal payments', category: 'payment' },
  { key: 'split_payment', label: 'Split Payment', description: 'Accept multiple payment methods for a single check', category: 'payment' },
  { key: 'change_payment_method', label: 'Change Payment Method', description: 'Correct a recorded payment method post-tender', category: 'payment', isSensitive: true },
  { key: 'refund_payment', label: 'Refund Payment', description: 'Process full or partial payment refunds', category: 'payment', isSensitive: true },
  { key: 'reopen_paid_check', label: 'Reopen Paid Check', description: 'Modify and re-settle an already paid transaction', category: 'payment', isSensitive: true },
  { key: 'view_own_sales', label: 'View Own Sales', description: 'View personal sales totals and tips for current shift', category: 'payment' },
  { key: 'view_all_sales', label: 'View All Sales', description: 'View sales and cash across all team members and registers', category: 'payment' },
  { key: 'access_cash_drawer', label: 'Access Cash Drawer', description: 'Trigger physical cash drawer opening without a sale', category: 'payment', isSensitive: true },
  { key: 'cash_adjustment', label: 'Cash Adjustment', description: 'Record cash-in / pay-out corrections and drops', category: 'payment', isSensitive: true },

  // ── D. Supervisor & Administrative Controls ──
  { key: 'authorize_restricted_action', label: 'Authorize Restricted Action', description: 'Approve actions requiring supervisor PIN override', category: 'supervisor' },
  { key: 'override_order_restrictions', label: 'Override Order Restrictions', description: 'Override kitchen 86 limits, hold blocks and shift cutoffs', category: 'supervisor' },
  { key: 'manage_pos_permissions', label: 'Manage POS Permissions', description: 'Change POS user permissions, roles and overrides', category: 'supervisor' },
  { key: 'view_pos_audit_log', label: 'View POS Audit Log', description: 'Access real-time POS authorization and security audit history', category: 'supervisor' },
  { key: 'configure_pos_settings', label: 'Configure POS Settings', description: 'Change operational POS settings, VAT, screen builder', category: 'supervisor' },
  { key: 'manage_pos_devices', label: 'Manage POS Devices', description: 'Authorize and link physical POS terminals and printers', category: 'supervisor' },

  // ── E. Multi-Concept Controls (Phase 1) ──
  { key: 'switch_pos_concept', label: 'Switch Concept Workspace', description: 'Toggle between NÉO, OVRLOAD, and WICKD workspaces in POS', category: 'supervisor' },
  { key: 'view_all_concepts', label: 'View All Concepts', description: 'Unrestricted visibility across all concepts regardless of assignment', category: 'supervisor' },
  { key: 'view_concept_sales', label: 'View Concept Sales', description: 'View sales and order history for authorized concepts', category: 'supervisor' },
  { key: 'view_concept_costs', label: 'View Concept Food Costs', description: 'View recipe costing and production batch yields for concept', category: 'supervisor' },
  { key: 'view_concept_profitability', label: 'View Concept Profitability', description: 'Access concept-level contribution margins and P&L snapshots', category: 'supervisor', isSensitive: true }
];

export const ROLE_DISPLAY_NAMES: Record<PosRoleName, string> = {
  waiter: 'Waiter',
  runner: 'Runner',
  cashier: 'Cashier',
  floor_supervisor: 'Floor Supervisor',
  manager: 'Manager',
  administrator: 'Administrator'
};

export const ROLE_DESCRIPTIONS: Record<PosRoleName, string> = {
  waiter: 'Floor service staff taking orders and serving tables',
  runner: 'Food & beverage delivery runner supporting service',
  cashier: 'Payment desk, counter checkout and drawer operator',
  floor_supervisor: 'Senior floor leader approving voids, discounts and transfers',
  manager: 'Full operational store leadership across all shifts and audits',
  administrator: 'System admin with full authorization and policy management'
};

// ── Default Role Templates as specified in section 3 ──
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
    switch_pos_concept: true,
    view_all_concepts: true,
    view_concept_sales: true,
    view_concept_costs: true,
    view_concept_profitability: true
  }
};

export type PermissionOverrideState = 'inherit' | 'allow' | 'deny';

export interface EmployeePosConfig {
  user_id: string;
  name: string;
  display_name?: string | null;
  role: string;
  normalized_role: PosRoleName;
  branch: string;
  is_active: boolean;
  can_access_pos: boolean;
  overrides: Partial<Record<PosPermissionKey, PermissionOverrideState>>;
  pin?: string;
  allowed_concepts?: string[];
  default_concept_id?: string;
  effective_permissions: Record<PosPermissionKey, {
    granted: boolean;
    source: 'override_allow' | 'override_deny' | 'inherited_role' | 'default_deny';
  }>;
}

export interface PosAuditLogEntry {
  id: string;
  created_at: string;
  employee_id: string;
  employee_name: string;
  authorizer_id?: string | null;
  authorizer_name?: string | null;
  branch?: string;
  table_number?: string | null;
  order_id?: string | number | null;
  action_type: string;
  action_label: string;
  previous_value?: any;
  new_value?: any;
  reason?: string | null;
  status: 'approved' | 'rejected' | 'direct';
  restaurant_id: string;
}

// ── Normalize Role string to PosRoleName ──
export function normalizePosRole(roleStr?: string | null): PosRoleName {
  if (!roleStr) return 'waiter';
  const clean = roleStr.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (clean.includes('admin') || clean.includes('owner')) return 'administrator';
  if (clean.includes('manager') || clean.includes('gm') || clean.includes('incharge')) return 'manager';
  if (clean.includes('supervisor') || clean.includes('lead') || clean.includes('captain') || clean.includes('headwaiter')) return 'floor_supervisor';
  if (clean.includes('cashier') || clean.includes('cash') || clean.includes('billing')) return 'cashier';
  if (clean.includes('runner') || clean.includes('busser') || clean.includes('barback') || clean.includes('commis')) return 'runner';
  if (clean.includes('waiter') || clean.includes('waitress') || clean.includes('server') || clean.includes('steward')) return 'waiter';
  return 'waiter';
}

// ── Resolve Effective Permissions following precedence (Section 6) ──
// 1. Employee-specific override (Allow / Deny)
// 2. Assigned role permission
// 3. Default Deny
export function resolveEffectivePermissions(
  userRole: string,
  overrides: Partial<Record<PosPermissionKey, PermissionOverrideState>> = {},
  customRoleTemplates?: Partial<Record<PosRoleName, Record<PosPermissionKey, boolean>>>
): Record<PosPermissionKey, { granted: boolean; source: 'override_allow' | 'override_deny' | 'inherited_role' | 'default_deny' }> {
  const normRole = normalizePosRole(userRole);
  const roleConfig = {
    ...DEFAULT_ROLE_PERMISSIONS[normRole],
    ...(customRoleTemplates?.[normRole] || {})
  };

  const result: any = {};

  POS_PERMISSION_DEFINITIONS.forEach(def => {
    const override = overrides[def.key];
    if (override === 'allow') {
      result[def.key] = { granted: true, source: 'override_allow' };
    } else if (override === 'deny') {
      result[def.key] = { granted: false, source: 'override_deny' };
    } else {
      // Inherit from role template
      const roleAllowed = !!roleConfig[def.key];
      result[def.key] = {
        granted: roleAllowed,
        source: roleAllowed ? 'inherited_role' : 'default_deny'
      };
    }
  });

  return result;
}
