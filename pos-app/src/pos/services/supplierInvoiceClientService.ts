import { supabase, getGlobalRestaurantId } from '../../api/supabase';

export interface SupplierInvoiceItemPayload {
  id?: string;
  item_id?: string | null;
  item_name?: string;
  supplier_product_code?: string;
  supplier_description?: string;
  invoiced_quantity: number;
  purchase_unit: string;
  unit_price: number;
  discount_rate?: number;
  tax_rate?: number;
  vat_amount?: number;
  line_total: number;
  package_quantity?: number;
  package_unit?: string;
  conversion_factor?: number;
  base_quantity?: number;
  base_unit?: string;
  matched_receipt_item_id?: string;
  matched_quantity?: number;
  confidence_score?: number;
  needs_review?: boolean;
  review_reasons?: string[];
  price_variance_pct?: number;
}

export interface ValidateAndPostInvoicePayload {
  restaurant_id: string;
  branch_id: string;
  supplier_id: string;
  invoice_id?: string; // If posting an existing draft
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  currency?: string;
  exchange_rate?: number;
  subtotal: number;
  tax_rate?: number;
  tax_amount?: number;
  tax_total?: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string;
  idempotency_key?: string;
  confirm_goods_received?: boolean;
  replaces_invoice_id?: string;
  replacement_reason?: string;
  override_review?: boolean;
  override_reason?: string;
  source_client?: string;
  attachment_url?: string;
  items: SupplierInvoiceItemPayload[];
}

export const supplierInvoiceClientService = {
  getRestaurantId(): string {
    return getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
  },

  /**
   * Fetch supplier invoices list with filters
   */
  async getInvoices(params: {
    restaurantId?: string;
    branchId?: string;
    supplierId?: string;
    status?: string;
    search?: string;
    limit?: number;
  }) {
    const rId = params.restaurantId || this.getRestaurantId();
    let query = supabase
      .from('supplier_invoices')
      .select(`
        id, invoice_number, invoice_date, due_date,
        invoice_currency, exchange_rate, subtotal_amount,
        tax_amount, total_amount, total_amount_usd,
        status, payment_status, receipt_status,
        attachment_url, notes, created_by, created_at,
        version,
        suppliers (id, name, phone)
      `)
      .eq('restaurant_id', rId)
      .order('created_at', { ascending: false });

    if (params.branchId) {
      query = query.eq('branch_id', params.branchId);
    }
    if (params.supplierId) {
      query = query.eq('supplier_id', params.supplierId);
    }
    if (params.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }
    if (params.search) {
      query = query.or(`invoice_number.ilike.%${params.search}%,notes.ilike.%${params.search}%`);
    }
    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch invoice details with line items
   */
  async getInvoiceDetails(invoiceId: string) {
    const { data: invoice, error: invError } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        suppliers (id, name, phone, address)
      `)
      .eq('id', invoiceId)
      .single();

    if (invError) throw invError;

    const { data: items, error: itemsError } = await supabase
      .from('supplier_invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    return {
      ...invoice,
      items: items || []
    };
  },

  /**
   * Stage C: Evaluate line item matching
   */
  async matchItem(params: {
    restaurantId?: string;
    supplierId?: string;
    supplierProductCode?: string;
    supplierDescription: string;
    purchaseUnit?: string;
    unitPrice?: number;
  }) {
    const { data, error } = await supabase.rpc('match_supplier_invoice_item', {
      p_payload: {
        restaurant_id: params.restaurantId || this.getRestaurantId(),
        supplier_id: params.supplierId || null,
        supplier_product_code: params.supplierProductCode || null,
        supplier_description: params.supplierDescription,
        purchase_unit: params.purchaseUnit || 'unit',
        unit_price: params.unitPrice || 0
      }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Stage C: Confirm supplier item mapping
   */
  async confirmItemMapping(params: {
    restaurantId?: string;
    supplierId: string;
    supplierProductCode?: string;
    supplierItemDesc: string;
    flowItemId: string;
    packageSize: number;
    purchaseUnit: string;
    notes?: string;
  }, callingUserId?: string) {
    const { data, error } = await supabase.rpc('confirm_supplier_item_mapping', {
      p_payload: {
        restaurant_id: params.restaurantId || this.getRestaurantId(),
        supplier_id: params.supplierId,
        supplier_product_code: params.supplierProductCode || null,
        supplier_item_desc: params.supplierItemDesc,
        flow_item_id: params.flowItemId,
        package_size: params.packageSize,
        purchase_unit: params.purchaseUnit,
        notes: params.notes || 'Mapping confirmed via FLOW Client'
      },
      p_calling_user_id: callingUserId || null
    });

    if (error) throw error;
    return data;
  },

  /**
   * Stage D: Create draft invoice
   */
  async createDraftInvoice(payload: any, callingUserId?: string) {
    const { data, error } = await supabase.rpc('create_draft_invoice_from_extraction', {
      p_payload: {
        restaurant_id: payload.restaurant_id || this.getRestaurantId(),
        ...payload
      },
      p_calling_user_id: callingUserId || null
    });

    if (error) throw error;
    return data;
  },

  /**
   * Stage B: Validate and Post invoice
   */
  async validateAndPostInvoice(payload: ValidateAndPostInvoicePayload, callingUserId?: string) {
    const { data, error } = await supabase.rpc('validate_and_post_supplier_invoice', {
      p_payload: {
        restaurant_id: payload.restaurant_id || this.getRestaurantId(),
        ...payload
      },
      p_calling_user_id: callingUserId || null
    });

    if (error) throw error;
    return data;
  },

  /**
   * Stage B: Receive invoice goods
   */
  async receiveGoods(payload: {
    invoice_id: string;
    items?: Array<{ invoice_item_id: string; received_quantity?: number }>;
    received_by_name?: string;
  }, callingUserId?: string) {
    const { data, error } = await supabase.rpc('receive_invoice_goods', {
      p_payload: payload,
      p_calling_user_id: callingUserId || null
    });

    if (error) throw error;
    return data;
  },

  /**
   * Fetch supplier balance & spend
   */
  async getSupplierBalance(supplierId: string, restaurantId?: string) {
    const rId = restaurantId || this.getRestaurantId();
    const { data, error } = await supabase
      .from('supplier_invoices')
      .select('total_amount_usd, paid_amount_usd, payment_status, status')
      .eq('restaurant_id', rId)
      .eq('supplier_id', supplierId)
      .eq('status', 'POSTED');

    if (error) throw error;

    let totalInvoiced = 0;
    let totalPaid = 0;
    (data || []).forEach(inv => {
      totalInvoiced += Number(inv.total_amount_usd) || 0;
      totalPaid += Number(inv.paid_amount_usd) || 0;
    });

    return {
      totalInvoicedUsd: totalInvoiced,
      totalPaidUsd: totalPaid,
      outstandingBalanceUsd: totalInvoiced - totalPaid
    };
  },

  /**
   * Upload invoice image or PDF to private storage bucket
   */
  async uploadInvoiceDocument(file: File, restaurantId?: string): Promise<string> {
    const rId = restaurantId || this.getRestaurantId();
    const ext = file.name.split('.').pop() || 'jpg';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${rId}/invoices/${new Date().getFullYear()}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from('supplier-documents')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    return data.path;
  },

  /**
   * Real AI extraction using Gemini 2.5 Flash Multimodal Vision
   */
  async extractInvoiceFromImage(base64Image: string, mimeType: string = 'image/jpeg') {
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `You are an expert OCR and invoice extraction AI engine for restaurant operations.
Analyze this supplier invoice image carefully. Extract all structured details verbatim.
Important rules:
1. Preserve original supplier description and product codes exactly as printed on the bill.
2. Accurately extract invoiced quantity, purchase unit (e.g. carton, kg, l, box), unit price, tax/VAT rate, VAT amount, and line total.
3. Extract header fields: supplier name, supplier tax/registration ID, invoice number, invoice date (YYYY-MM-DD), payment due date, currency (USD or LBP), exchange rate, subtotal, total tax amount, discount, and grand total.

Return ONLY valid JSON matching this exact structure:
{
  "supplier_name": "string",
  "supplier_tax_id": "string or null",
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "currency": "USD or LBP",
  "exchange_rate": 89500,
  "subtotal": number,
  "tax_amount": number,
  "discount_amount": number,
  "total_amount": number,
  "items": [
    {
      "supplier_product_code": "string or null",
      "supplier_description": "string",
      "invoiced_quantity": number,
      "purchase_unit": "string",
      "unit_price": number,
      "tax_rate": number,
      "vat_amount": number,
      "line_total": number
    }
  ]
}
No markdown formatting, no code block backticks. Return raw JSON string only.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Extraction failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('No candidate content returned by AI model');
    }

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  }
};
