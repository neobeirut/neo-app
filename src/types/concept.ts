/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Concept Master Types & Interfaces (Phase 1)
 *
 * Defines the core data structures for multi-concept operations under
 * a single legal company entity.
 */

export type ConceptCode = 'NEO' | 'OVRLOAD' | 'WICKD';

export type ConceptType = 'RESTAURANT' | 'CLOUD_KITCHEN' | 'RETAIL' | 'VIRTUAL_BRAND' | 'BAR' | 'DELIVERY_PICKUP';

export type ChannelCode = 'TOTERS' | 'NOKNOK' | 'WHATSAPP' | 'POS_PICKUP' | 'DIRECT_APP';

export type CommissionCalcBase = 'GROSS_SUBTOTAL' | 'NET_SUBTOTAL' | 'TOTAL_INVOICE';

export interface ConceptChannelAgreement {
  id?: string;
  concept_id: string;
  channel_code: ChannelCode;
  commission_type: 'PERCENTAGE' | 'FIXED' | 'HYBRID' | 'NONE';
  commission_rate: number; // e.g. 15.00 (%)
  fixed_order_fee: number;
  commission_calc_base: CommissionCalcBase;
  merchant_funded_promo_pct: number;
  marketplace_funded_promo_pct: number;
  additional_fee_pct: number;
  additional_fixed_fee: number;
  vat_treatment: 'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT';
  delivery_fee_policy: 'MARKETPLACE_HANDLED' | 'MERCHANT_HANDLED_TIER' | 'FREE_DELIVERY';
  receivable_account_code: string;
  settlement_frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  effective_from?: string;
  effective_to?: string | null;
  is_active: boolean;
}

export type ConceptStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/** Canonical default concept ID for NÉO Beirut (backward compatibility fallback) */
export const DEFAULT_CONCEPT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_CONCEPT_CODE: ConceptCode = 'NEO';

export const KNOWN_CONCEPTS: Record<ConceptCode, { id: string; name: string; prefix: string; primaryColor: string; description: string; tagline: string }> = {
  NEO: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'NÉO',
    prefix: 'NEO',
    primaryColor: '#1e5c4f',
    description: 'NÉO — Restaurant, Café, Bakery & Pastry',
    tagline: 'Restaurant, Café, Bakery & Pastry'
  },
  OVRLOAD: {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'OVRLOAD',
    prefix: 'OVR',
    primaryColor: '#e11d48',
    description: 'OVRLOAD — Loaded Wraps & Delivery',
    tagline: 'Loaded Wraps & Delivery'
  },
  WICKD: {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'WICKD',
    prefix: 'WCK',
    primaryColor: '#7c3aed',
    description: 'WICKD — Cinnamon-Roll Delivery Brand',
    tagline: 'Cinnamon-Roll Delivery Brand'
  }
};

export interface BusinessConcept {
  id: string;
  code: string;
  name: string;
  legal_entity_name: string;
  concept_type: ConceptType;
  status: ConceptStatus;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  currency: string;
  default_branch_id: string | null;
  receipt_prefix: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConceptBranchAssignment {
  id: string;
  concept_id: string;
  branch_id: string;
  is_primary: boolean;
  enabled: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  concept?: BusinessConcept;
}

export type InvoiceSeries = 'STANDARD' | 'A';

export interface ConceptInvoiceSequenceInfo {
  id: string;
  concept_id: string;
  invoice_series: InvoiceSeries | string;
  prefix: string;
  pad_length: number;
  current_val: number;
  last_allocated_at?: string | null;
  updated_at: string;
}

export interface ConceptPosConfiguration {
  id: string;
  concept_id: string;
  branch_id: string;
  menu_id: string | null;
  price_list_id: string | null;
  default_inventory_location_id: string | null;
  default_sales_channel: string;
  receipt_branding: {
    tagline?: string;
    show_logo?: boolean;
    custom_footer?: string;
  };
  receipt_sequence_config: {
    prefix: string;
    pad_length: number;
    current_val: number;
    standard_current_val?: number;
    a_series_current_val?: number;
  };
  allowed_payment_methods: string[];
  printer_configuration: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConceptAuthorizationContext {
  userId: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  allowedConceptIds: string[];
  activeConceptId: string;
  activeConcept: BusinessConcept | null;
}
