import postgres from 'postgres';
import crypto from 'crypto';

export interface ExtractionInput {
  restaurantId: string;
  branchId: string;
  userId?: string;
  sourceClient?: 'POS' | 'MOBILE' | 'ADMIN' | 'API';
  fileName: string;
  fileType: string;
  fileBuffer?: Buffer;
  storagePath?: string;
  rawOcrJson?: any; // If coming from client scanner or mock
}

export interface ExtractedSupplier {
  name: string;
  taxId?: string;
  phone?: string;
  address?: string;
  matchedSupplierId?: string;
  confidence: number;
}

export interface ExtractedLineItem {
  supplierProductCode?: string;
  supplierDescription: string;
  quantity: number;
  purchaseUnit: string;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  vatAmount: number;
  lineTotal: number;

  // Stage C enriched fields
  matchedItemId?: string;
  matchedItemName?: string;
  matchType?: string;
  confidenceScore?: number;
  conversionFactor?: number;
  baseQuantity?: number;
  baseUnit?: string;
  needsReview?: boolean;
  reviewReasons?: string[];
  priceVariancePct?: number;
}

export interface ExtractionResult {
  success: boolean;
  draftInvoiceId?: string;
  extractionId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  totalAmount: number;
  totalAmountUsd: number;
  totalAmountLbp: number;
  supplier: ExtractedSupplier;
  items: ExtractedLineItem[];
  reconciliation: {
    calculatedSubtotal: number;
    calculatedTotal: number;
    subtotalDiscrepancy: number;
    totalDiscrepancy: number;
    isBalanced: boolean;
  };
  qualityAssessment: {
    score: number;
    issues: string[];
    detectedLanguages: string[];
  };
  isDuplicate: boolean;
  duplicateOfInvoiceId?: string;
  reviewFlags: string[];
  status: 'DRAFT';
}

export class AiInvoiceExtractionEngine {
  private sql: postgres.Sql;

  constructor(sqlInstance: postgres.Sql) {
    this.sql = sqlInstance;
  }

  /**
   * Assess image quality and calculate preliminary readiness score
   */
  public assessQuality(fileName: string, fileType: string, buffer?: Buffer): { score: number; issues: string[]; languages: string[] } {
    const issues: string[] = [];
    let score = 1.0;

    if (buffer) {
      const sizeKb = buffer.length / 1024;
      if (sizeKb < 15) {
        issues.push('IMAGE_VERY_LOW_RESOLUTION_OR_CORRUPT');
        score -= 0.5;
      } else if (sizeKb < 50) {
        issues.push('IMAGE_LOW_COMPRESSION');
        score -= 0.2;
      }
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic'].includes(ext || '')) {
      issues.push('UNSUPPORTED_OR_SUSPICIOUS_EXTENSION');
      score -= 0.4;
    }

    // Standard expected languages in Lebanese/Arab restaurant supply
    const languages = ['en', 'ar', 'fr'];

    return {
      score: Math.max(0.1, Math.min(1.0, score)),
      issues,
      languages
    };
  }

  /**
   * Resolve supplier against FLOW public.suppliers
   */
  public async resolveSupplier(restaurantId: string, extractedName: string, extractedTaxId?: string, extractedPhone?: string): Promise<ExtractedSupplier> {
    const cleanName = (extractedName || '').trim().toLowerCase();
    const cleanTaxId = (extractedTaxId || '').trim();
    const cleanPhone = (extractedPhone || '').trim().replace(/[^0-9]/g, '');

    // 1. Try exact Tax ID / MOF match
    if (cleanTaxId) {
      const [byTax] = await this.sql`
        SELECT id, name FROM public.suppliers 
        WHERE restaurant_id = ${restaurantId}::uuid 
          AND (tax_id = ${cleanTaxId} OR notes LIKE ${'%' + cleanTaxId + '%'})
        LIMIT 1;
      `;
      if (byTax) {
        return { name: byTax.name, taxId: cleanTaxId, matchedSupplierId: byTax.id, confidence: 1.0 };
      }
    }

    // 2. Try exact phone match
    if (cleanPhone && cleanPhone.length >= 7) {
      const [byPhone] = await this.sql`
        SELECT id, name FROM public.suppliers 
        WHERE restaurant_id = ${restaurantId}::uuid 
          AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${cleanPhone}
        LIMIT 1;
      `;
      if (byPhone) {
        return { name: byPhone.name, phone: cleanPhone, matchedSupplierId: byPhone.id, confidence: 0.95 };
      }
    }

    // 3. Try exact name match
    const [byName] = await this.sql`
      SELECT id, name FROM public.suppliers 
      WHERE restaurant_id = ${restaurantId}::uuid 
        AND lower(name) = ${cleanName}
      LIMIT 1;
    `;
    if (byName) {
      return { name: byName.name, matchedSupplierId: byName.id, confidence: 0.98 };
    }

    // 4. Try fuzzy similarity match
    const [fuzzy] = await this.sql`
      SELECT id, name, similarity(lower(name), ${cleanName}) as sim
      FROM public.suppliers
      WHERE restaurant_id = ${restaurantId}::uuid 
        AND similarity(lower(name), ${cleanName}) >= 0.60
      ORDER BY sim DESC
      LIMIT 1;
    `;
    if (fuzzy) {
      return {
        name: fuzzy.name,
        matchedSupplierId: fuzzy.id,
        confidence: Number(Number(fuzzy.sim).toFixed(2))
      };
    }

    // Unmatched
    return {
      name: extractedName,
      taxId: extractedTaxId,
      phone: extractedPhone,
      matchedSupplierId: undefined,
      confidence: 0.0
    };
  }

  /**
   * Central Extraction Execution Pipeline
   */
  public async processExtraction(input: ExtractionInput): Promise<ExtractionResult> {
    const fileHash = input.fileBuffer
      ? crypto.createHash('sha256').update(input.fileBuffer).digest('hex')
      : crypto.createHash('sha256').update(input.fileName + Date.now()).digest('hex');

    const quality = this.assessQuality(input.fileName, input.fileType, input.fileBuffer);

    // Parse structured data (either provided by multimodal OCR payload or parsed)
    const rawData = input.rawOcrJson || {};
    const extractedInvoiceNumber = rawData.invoice_number || ('DRAFT-SCAN-' + Date.now());
    const extractedDate = rawData.invoice_date || new Date().toISOString().split('T')[0];
    const currency = (rawData.currency || 'USD').toUpperCase();
    const exchangeRate = Number(rawData.exchange_rate) || 89500;

    // Supplier resolution
    const supplierRes = await this.resolveSupplier(
      input.restaurantId,
      rawData.supplier_name || '',
      rawData.supplier_tax_id,
      rawData.supplier_phone
    );

    // Duplicate detection
    let isDuplicate = false;
    let duplicateOfId: string | undefined;

    if (supplierRes.matchedSupplierId && rawData.invoice_number) {
      const [dup] = await this.sql`
        SELECT id FROM public.supplier_invoices
        WHERE restaurant_id = ${input.restaurantId}::uuid
          AND supplier_id = ${supplierRes.matchedSupplierId}::uuid
          AND lower(invoice_number) = lower(${rawData.invoice_number})
          AND status IN ('POSTED', 'DRAFT', 'PENDING_REVIEW')
        LIMIT 1;
      `;
      if (dup) {
        isDuplicate = true;
        duplicateOfId = dup.id;
      }
    }

    // Enrich items with Stage C matching engine
    const rawItems: any[] = rawData.items || [];
    const enrichedItems: ExtractedLineItem[] = [];
    const reviewFlags: string[] = [];

    if (isDuplicate) {
      reviewFlags.push('DUPLICATE_INVOICE_WARNING');
    }
    if (!supplierRes.matchedSupplierId) {
      reviewFlags.push('UNKNOWN_SUPPLIER');
    }

    let calculatedSubtotal = 0;
    let calculatedVat = 0;

    for (const rawItem of rawItems) {
      const qty = Number(rawItem.quantity) || 1.0;
      const price = Number(rawItem.unit_price) || 0.0;
      const discount = Number(rawItem.discount_rate) || 0.0;
      const taxRate = Number(rawItem.tax_rate) || (currency === 'LBP' ? 11.0 : 0.0);
      const lineSubtotal = qty * price * (1 - discount / 100);
      const vatAmount = lineSubtotal * (taxRate / 100);
      const lineTotal = lineSubtotal + vatAmount;

      calculatedSubtotal += lineSubtotal;
      calculatedVat += vatAmount;

      // Invoke Stage C matching RPC
      let matchRes: any = null;
      try {
        const [rpcRes] = await this.sql`
          SELECT public.match_supplier_invoice_item(${this.sql.json({
            restaurant_id: input.restaurantId,
            supplier_id: supplierRes.matchedSupplierId || null,
            supplier_product_code: rawItem.supplier_product_code || null,
            supplier_description: rawItem.supplier_description || rawItem.item_name,
            purchase_unit: rawItem.purchase_unit || 'unit',
            unit_price: price
          })}) as res;
        `;
        matchRes = rpcRes.res;
      } catch (err: any) {
        console.warn('Stage C matching lookup warning:', err.message);
      }

      const itemNeedsReview = matchRes ? matchRes.needs_review : true;
      const reasons: string[] = matchRes?.review_reasons || [];
      if (!matchRes?.matched_item_id) {
        reasons.push('UNMATCHED_PRODUCT');
      }

      enrichedItems.push({
        supplierProductCode: rawItem.supplier_product_code,
        supplierDescription: rawItem.supplier_description || rawItem.item_name,
        quantity: qty,
        purchaseUnit: rawItem.purchase_unit || 'unit',
        unitPrice: price,
        discountRate: discount,
        taxRate: taxRate,
        vatAmount: Number(vatAmount.toFixed(4)),
        lineTotal: Number(lineTotal.toFixed(4)),

        matchedItemId: matchRes?.matched_item_id,
        matchedItemName: matchRes?.matched_item_name,
        matchType: matchRes?.match_type || 'UNMATCHED',
        confidenceScore: matchRes?.confidence_score || 0.0,
        conversionFactor: matchRes?.conversion_factor || 1.0,
        baseQuantity: qty * (matchRes?.conversion_factor || 1.0),
        baseUnit: matchRes?.base_unit || rawItem.purchase_unit || 'unit',
        needsReview: itemNeedsReview,
        reviewReasons: reasons,
        priceVariancePct: matchRes?.price_variance_pct || 0.0
      });
    }

    // Financial reconciliation
    const declaredSubtotal = Number(rawData.subtotal) || calculatedSubtotal;
    const declaredTotal = Number(rawData.total_amount) || (calculatedSubtotal + calculatedVat);
    const subtotalDiff = Math.abs(calculatedSubtotal - declaredSubtotal);
    const totalDiff = Math.abs((calculatedSubtotal + calculatedVat) - declaredTotal);
    const isBalanced = subtotalDiff < 0.05 && totalDiff < 0.05;

    if (!isBalanced) {
      reviewFlags.push('FINANCIAL_TOTAL_MISMATCH');
    }

    // Persist as DRAFT in database via create_draft_invoice_from_extraction
    const [draftRes] = await this.sql`
      SELECT public.create_draft_invoice_from_extraction(${this.sql.json({
        restaurant_id: input.restaurantId,
        branch_id: input.branchId,
        supplier_id: supplierRes.matchedSupplierId || null,
        invoice_number: extractedInvoiceNumber,
        invoice_date: extractedDate,
        currency: currency,
        exchange_rate: exchangeRate,
        subtotal: Number(declaredSubtotal.toFixed(4)),
        tax_amount: Number(calculatedVat.toFixed(4)),
        discount_amount: Number((rawData.discount_amount || 0).toFixed(4)),
        total_amount: Number(declaredTotal.toFixed(4)),
        attachment_url: input.storagePath || ('supplier-documents/' + fileHash),
        source_client: input.sourceClient || 'API',
        ai_confidence_score: quality.score,
        raw_ocr_payload: rawData,
        items: enrichedItems.map(item => ({
          item_id: item.matchedItemId || null,
          item_name: item.matchedItemName || item.supplierDescription,
          supplier_product_code: item.supplierProductCode,
          supplier_description: item.supplierDescription,
          invoiced_quantity: item.quantity,
          purchase_unit: item.purchaseUnit,
          unit_price: item.unitPrice,
          discount_rate: item.discountRate,
          tax_rate: item.taxRate,
          vat_amount: item.vatAmount,
          line_total: item.lineTotal,
          conversion_factor: item.conversionFactor,
          base_quantity: item.baseQuantity,
          base_unit: item.baseUnit,
          confidence_score: item.confidenceScore,
          needs_review: item.needsReview,
          review_reasons: item.reviewReasons
        })),
        extraction_telemetry: {
          storage_path: input.storagePath || ('supplier-documents/' + fileHash),
          file_name: input.fileName,
          file_type: input.fileType,
          file_size_bytes: input.fileBuffer?.length || 0,
          file_hash_sha256: fileHash,
          page_count: rawData.page_count || 1,
          image_quality_score: quality.score,
          model_name: 'gemini-1.5-flash',
          extracted_supplier_name: rawData.supplier_name,
          extracted_supplier_tax_id: rawData.supplier_tax_id
        }
      })}, ${input.userId || null}::uuid) as res;
    `;

    return {
      success: true,
      draftInvoiceId: draftRes.res.draft_invoice_id,
      extractionId: draftRes.res.extraction_id,
      invoiceNumber: extractedInvoiceNumber,
      invoiceDate: extractedDate,
      currency: currency,
      exchangeRate: exchangeRate,
      subtotal: declaredSubtotal,
      taxTotal: calculatedVat,
      discountTotal: Number(rawData.discount_amount || 0),
      totalAmount: declaredTotal,
      totalAmountUsd: currency === 'USD' ? declaredTotal : declaredTotal / exchangeRate,
      totalAmountLbp: currency === 'LBP' ? declaredTotal : declaredTotal * exchangeRate,
      supplier: supplierRes,
      items: enrichedItems,
      reconciliation: {
        calculatedSubtotal,
        calculatedTotal: calculatedSubtotal + calculatedVat,
        subtotalDiscrepancy: subtotalDiff,
        totalDiscrepancy: totalDiff,
        isBalanced
      },
      qualityAssessment: quality,
      isDuplicate,
      duplicateOfInvoiceId: duplicateOfId,
      reviewFlags,
      status: 'DRAFT'
    };
  }
}
