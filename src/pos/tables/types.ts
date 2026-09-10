export type TableShape = 'square' | 'rectangle' | 'round';

export type TableStatus = 'available' | 'occupied' | 'bill_requested' | 'reserved';

export type TableSessionStatus = 
  | 'opening'
  | 'occupied'
  | 'bill_requested'
  | 'closing'
  | 'closed'
  | 'failed';

export interface FloorArea {
  id: string;
  branch_id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface PosTable {
  id: string;
  branch_id: string;
  floor_area_id: string;
  table_code: string;
  display_name: string;
  capacity: number;
  position_x: number; // 0-100 normalized
  position_y: number; // 0-100 normalized
  width: number;
  height: number;
  shape: TableShape;
  active: boolean;
  sort_order: number;

  // Runtime operational state
  status?: TableStatus;
  current_session_id?: string | null;
  commerce_order_id?: number | null;
  assigned_waiter?: string | null;
  guest_count?: number | null;
  current_bill?: number | null;
  amount_paid?: number | null;
  amount_remaining?: number | null;
  elapsed_minutes?: number | null;
  is_primary?: boolean;
  merged_table_codes?: string[];
}

export interface TableSessionTableLink {
  id: string;
  session_id: string;
  table_id: string;
  is_primary: boolean;
  joined_at: string;
  table?: PosTable;
}

export interface TableSession {
  id: string;
  branch_id: string;
  restaurant_id: string;
  commerce_order_id: number | null;
  opened_by_user_id: string | null;
  opened_by_name_snapshot: string;
  assigned_waiter_user_id: string | null;
  assigned_waiter_name_snapshot: string;
  guest_count: number;
  status: TableSessionStatus;
  opened_at: string;
  bill_requested_at?: string | null;
  closed_at?: string | null;
  version: number;
  tables?: TableSessionTableLink[];
}

export interface CheckAllocationItem {
  id: number;
  check_id: number;
  order_item_id: number;
  quantity: number;
  allocated_amount: number;
  product_name?: string;
  unit_price?: number;
  customizations?: string;
}

export interface OrderCheck {
  id: number;
  order_id: number;
  check_number: number;
  label: string;
  status: 'open' | 'partially_paid' | 'paid' | 'cancelled';
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  split_operation_id: string | null;
  items?: CheckAllocationItem[];
}

export interface OpenTableParams {
  tableId: string;
  tableCode: string;
  branchId: string;
  restaurantId: string;
  externalBranchId?: string;
  guestCount: number;
  waiterUserId?: string | null;
  waiterName: string;
  operatorUserId?: string | null;
  operatorName: string;
}

export interface TransferTableParams {
  sessionId: string;
  commerceOrderId: number;
  fromTableId: string;
  toTableId: string;
  toTableCode: string;
  operatorName: string;
}

export interface MergeTableParams {
  sessionId: string;
  commerceOrderId: number;
  primaryTableCode: string;
  secondaryTableId: string;
  secondaryTableCode: string;
  operatorName: string;
}
