export type KdsStationType = 'prep' | 'expo' | 'bar';

export type KdsFireItemStatus = 'queued' | 'preparing' | 'ready' | 'bumped' | 'voided';

export type KdsFireStatus = 'active' | 'completed' | 'cancelled';

export type KdsRoutingDisposition = 'production' | 'no_kitchen';

export interface KdsStation {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  station_type: KdsStationType;
  color: string;
  sort_order: number;
  active: boolean;
  display_mode: 'grid' | 'carousel';
  allow_bump_all: boolean;
  sound_enabled: boolean;
  default_timer_yellow_seconds: number;
  default_timer_red_seconds: number;
  printer_destination_key?: string | null;
  default_printer_ip?: string | null;
  default_printer_port?: number | null;
}

export interface KdsFireItemModifier {
  id?: string | number;
  name: string;
  action?: 'add' | 'remove' | 'no';
  price?: number;
}

export interface KdsFireItem {
  id: number;
  fire_id: number;
  order_item_id: number | null;
  quantity: number;
  station_key: string;
  status: KdsFireItemStatus;
  product_name_snapshot: string;
  modifiers_snapshot: KdsFireItemModifier[];
  notes_snapshot: string | null;
  started_at?: string | null;
  ready_at?: string | null;
  bumped_at?: string | null;
  voided_at?: string | null;
  refire_of_fire_item_id?: number | null;
  refire_reason?: string | null;
  refire_requested_by?: string | null;
  created_at: string;
}

export interface KdsFire {
  id: number;
  operation_id: string;
  order_id: number;
  fire_number: number;
  location_key: string;
  service_type: string;
  table_label_snapshot: string | null;
  guest_count_snapshot: number | null;
  waiter_reference_snapshot: string | null;
  fired_by_reference: string | null;
  terminal_id: string | null;
  status: KdsFireStatus;
  fired_at: string;
  created_at: string;
  items: KdsFireItem[];
}

export interface KdsProductRouting {
  id: string;
  branch_id: string;
  commerce_product_link_id: string;
  station_id?: string | null;
  fallback_station_id?: string | null;
  disposition: KdsRoutingDisposition;
  active: boolean;
  product_name?: string;
  category_name?: string;
  station_code?: string;
  station_name?: string;
}

export interface KdsRoutingCoverageSummary {
  totalProducts: number;
  routedCount: number;
  unroutedCount: number;
  noKitchenCount: number;
  routings: KdsProductRouting[];
}

export interface KdsEventPayload {
  event_id: string;
  type: 'kds_new_fire' | 'kds_item_status_changed' | 'kds_item_refired' | 'kds_fire_bumped';
  location_key: string;
  timestamp: string;
  [key: string]: any;
}
