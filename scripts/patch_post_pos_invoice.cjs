const postgres = require('postgres');
const DB_URL = 'postgresql://postgres.ilrlychrraagugntqdfr:7fs0%26cUGaX4j04kc3AzR@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
const sql = postgres(DB_URL, { max: 1 });

async function patch() {
  console.log('Patching post_pos_supplier_invoice and settle_supplier_invoices...');
  await sql.unsafe(`
CREATE OR REPLACE FUNCTION public.post_pos_supplier_invoice(
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_restaurant_id UUID;
    v_branch_id TEXT;
    v_supplier_id UUID;
    v_po_id UUID;
    v_invoice_number TEXT;
    v_invoice_date DATE;
    v_due_date DATE;
    v_currency TEXT;
    v_exchange_rate NUMERIC;
    v_subtotal NUMERIC := 0;
    v_tax_rate NUMERIC := 0;
    v_tax_amount NUMERIC := 0;
    v_discount_amount NUMERIC := 0;
    v_total_native NUMERIC := 0;
    v_total_usd NUMERIC := 0;
    v_total_lbp NUMERIC := 0;
    v_is_direct_purchase BOOLEAN;
    v_confirm_goods_received BOOLEAN;
    v_notes TEXT;
    v_created_by TEXT;
    v_idempotency_key TEXT;

    -- Immediate Payment Fields
    v_pay_now BOOLEAN;
    v_payment_method TEXT;
    v_shift_id UUID;
    v_paid_usd NUMERIC := 0;
    v_paid_lbp NUMERIC := 0;

    -- Created Records
    v_invoice_id UUID;
    v_receipt_id UUID;
    v_receipt_number TEXT;
    v_payment_id UUID;
    v_item RECORD;
    v_inv_item_id UUID;
    v_gr_item_id UUID;
    v_items_array JSONB;
    v_elem JSONB;
    v_receipt_res JSONB;
    v_cash_res JSONB;
    v_existing_inv_id UUID;
    v_qty NUMERIC;
    v_price NUMERIC;
    v_loc_id UUID;
    v_default_loc UUID;
    v_receipt_loc UUID;
    v_item_name TEXT;
    v_po_item_id UUID;
BEGIN
    -- Extract Parameters
    v_restaurant_id := (p_payload->>'restaurant_id')::uuid;
    v_branch_id := p_payload->>'branch_id';
    v_supplier_id := (p_payload->>'supplier_id')::uuid;
    v_po_id := (p_payload->>'purchase_order_id')::uuid;
    v_invoice_number := TRIM(p_payload->>'invoice_number');
    v_invoice_date := COALESCE((p_payload->>'invoice_date')::date, CURRENT_DATE);
    v_due_date := (p_payload->>'due_date')::date;
    v_currency := COALESCE(p_payload->>'currency', 'USD');
    v_exchange_rate := COALESCE((p_payload->>'exchange_rate')::numeric, 1.0);
    v_is_direct_purchase := COALESCE((p_payload->>'is_direct_purchase')::boolean, false);
    v_confirm_goods_received := COALESCE((p_payload->>'confirm_goods_received')::boolean, (p_payload->>'confirm_received')::boolean, true);
    v_notes := p_payload->>'notes';
    v_created_by := COALESCE(p_payload->>'created_by', p_payload->>'user_name', 'POS Cashier');
    v_idempotency_key := p_payload->>'idempotency_key';

    v_pay_now := COALESCE((p_payload->>'pay_now')::boolean, false);
    v_payment_method := p_payload->>'payment_method';
    v_shift_id := (p_payload->>'shift_id')::uuid;
    v_paid_usd := COALESCE((p_payload->>'paid_amount_usd')::numeric, (p_payload->>'amount_usd')::numeric, 0);
    v_paid_lbp := COALESCE((p_payload->>'paid_amount_lbp')::numeric, (p_payload->>'amount_lbp')::numeric, 0);

    IF v_invoice_number IS NULL OR v_invoice_number = '' THEN
        RAISE EXCEPTION 'INVOICE_NUMBER_REQUIRED: Supplier invoice number is mandatory';
    END IF;

    -- 1. Idempotency Check
    IF v_idempotency_key IS NOT NULL AND v_idempotency_key <> '' THEN
        SELECT id INTO v_existing_inv_id 
        FROM public.supplier_invoices 
        WHERE idempotency_key = v_idempotency_key 
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'IDEMPOTENT_NOOP',
                'message', 'Invoice already processed for this idempotency key',
                'invoice_id', v_existing_inv_id
            );
        END IF;
    END IF;

    -- 2. Validate Supplier & Branch
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_supplier_id AND is_active = true) THEN
        RAISE EXCEPTION 'SUPPLIER_NOT_FOUND: Supplier % not found or inactive', v_supplier_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch_id) THEN
        RAISE EXCEPTION 'BRANCH_NOT_FOUND: Branch % not found', v_branch_id;
    END IF;

    -- 3. Calculate Totals from Items
    v_items_array := p_payload->'items';
    IF v_items_array IS NULL OR jsonb_array_length(v_items_array) = 0 THEN
        RAISE EXCEPTION 'ITEMS_REQUIRED: Supplier invoice must have at least one line item';
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
        v_qty := COALESCE((v_elem->>'purchase_quantity')::numeric, (v_elem->>'quantity')::numeric, 0);
        v_price := COALESCE((v_elem->>'unit_price')::numeric, (v_elem->>'purchase_unit_price')::numeric, 0);

        v_subtotal := v_subtotal + (
            v_qty * v_price * (1.0 - COALESCE((v_elem->>'discount_rate')::numeric, 0) / 100.0)
        );
        v_tax_amount := v_tax_amount + (
            v_qty * v_price * (1.0 - COALESCE((v_elem->>'discount_rate')::numeric, 0) / 100.0) * 
            (COALESCE((v_elem->>'tax_rate')::numeric, 0) / 100.0)
        );
    END LOOP;

    v_discount_amount := COALESCE((p_payload->>'discount_amount')::numeric, 0);
    v_total_native := v_subtotal + v_tax_amount - v_discount_amount;

    IF v_currency = 'LBP' THEN
        v_total_lbp := v_total_native;
        v_total_usd := ROUND(v_total_native / v_exchange_rate, 4);
    ELSE
        v_total_usd := v_total_native;
        v_total_lbp := ROUND(v_total_native * v_exchange_rate, 2);
    END IF;

    -- Auto-populate paid amount if pay_now = true and paid amounts were 0
    IF v_pay_now AND v_paid_usd = 0 AND v_paid_lbp = 0 THEN
        IF v_currency = 'LBP' THEN
            v_paid_lbp := v_total_lbp;
        ELSE
            v_paid_usd := v_total_usd;
        END IF;
    END IF;

    -- Normalize payment method to enum ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER')
    IF v_payment_method IS NOT NULL THEN
        IF UPPER(v_payment_method) LIKE '%CASH%' THEN
            v_payment_method := 'CASH';
        ELSIF UPPER(v_payment_method) LIKE '%BANK%' THEN
            v_payment_method := 'BANK_TRANSFER';
        ELSIF UPPER(v_payment_method) LIKE '%CHEQUE%' OR UPPER(v_payment_method) LIKE '%CHECK%' THEN
            v_payment_method := 'CHEQUE';
        ELSIF UPPER(v_payment_method) LIKE '%CARD%' THEN
            v_payment_method := 'CARD';
        ELSE
            v_payment_method := 'OTHER';
        END IF;
    END IF;

    -- 4. Create Supplier Invoice Header
    INSERT INTO public.supplier_invoices (
        restaurant_id, branch_id, supplier_id, purchase_order_id,
        invoice_number, invoice_date, due_date, invoice_currency,
        exchange_rate, subtotal_amount, tax_amount, discount_amount,
        total_amount, total_amount_usd, total_amount_lbp,
        paid_amount_usd, paid_amount_lbp, payment_status,
        receipt_status, is_direct_purchase, notes,
        idempotency_key, created_by
    ) VALUES (
        v_restaurant_id, v_branch_id, v_supplier_id, v_po_id,
        v_invoice_number, v_invoice_date, v_due_date, v_currency,
        v_exchange_rate, v_subtotal, v_tax_amount, v_discount_amount,
        v_total_native, v_total_usd, v_total_lbp,
        0, 0, 'UNPAID',
        CASE WHEN v_confirm_goods_received THEN 'FULLY_RECEIVED' ELSE 'NO_GOODS_RECEIVED' END,
        v_is_direct_purchase, v_notes,
        v_idempotency_key, v_created_by
    ) RETURNING id INTO v_invoice_id;

    -- Resolve default location for branch
    SELECT id INTO v_default_loc FROM public.inventory_locations WHERE restaurant_id::text = v_restaurant_id::text ORDER BY created_at ASC LIMIT 1;

    -- 5. Insert Supplier Invoice Line Items
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
        v_qty := COALESCE((v_elem->>'purchase_quantity')::numeric, (v_elem->>'quantity')::numeric, 1);
        v_price := COALESCE((v_elem->>'unit_price')::numeric, (v_elem->>'purchase_unit_price')::numeric, 0);
        v_loc_id := COALESCE((v_elem->>'location_id')::uuid, (v_elem->>'inventory_location_id')::uuid, v_default_loc);

        -- If linked to PO and po_item_id not provided, try resolving from PO items
        v_po_item_id := (v_elem->>'po_item_id')::uuid;
        IF v_po_item_id IS NULL AND v_po_id IS NOT NULL THEN
            SELECT id INTO v_po_item_id FROM public.purchase_order_items WHERE po_id = v_po_id AND item_id = (v_elem->>'item_id')::uuid LIMIT 1;
        END IF;

        SELECT name INTO v_item_name FROM public.items WHERE id = (v_elem->>'item_id')::uuid;

        DECLARE
            v_line_unit TEXT;
            v_line_base_unit TEXT;
            v_conversion_factor NUMERIC;
            v_base_quantity NUMERIC;
        BEGIN
            v_line_unit := COALESCE(v_elem->>'unit', v_elem->>'purchase_unit', 'pcs');
            SELECT COALESCE(base_unit, unit, v_line_unit) INTO v_line_base_unit FROM public.items WHERE id = (v_elem->>'item_id')::uuid;
            IF v_line_base_unit IS NULL OR v_line_base_unit = '' THEN
                v_line_base_unit := v_line_unit;
            END IF;

            v_conversion_factor := COALESCE((v_elem->>'conversion_factor')::numeric, (v_elem->>'base_quantity_per_purchase_unit')::numeric, 1.0);
            IF v_conversion_factor <= 0 THEN
                v_conversion_factor := 1.0;
            END IF;
            v_base_quantity := COALESCE((v_elem->>'base_quantity')::numeric, v_qty * v_conversion_factor);

            INSERT INTO public.supplier_invoice_items (
                invoice_id, po_item_id, item_id, item_name, invoiced_quantity,
                received_quantity, purchase_unit, base_unit, base_quantity, unit_price,
                discount_rate, tax_rate, line_total,
                inventory_location_id
            ) VALUES (
                v_invoice_id,
                v_po_item_id,
                (v_elem->>'item_id')::uuid,
                COALESCE(v_item_name, v_elem->>'item_name', 'Item'),
                v_qty,
                CASE WHEN v_confirm_goods_received THEN v_qty ELSE 0 END,
                v_line_unit,
                v_line_base_unit,
                v_base_quantity,
                v_price,
                COALESCE((v_elem->>'discount_rate')::numeric, 0),
                COALESCE((v_elem->>'tax_rate')::numeric, 0),
                ROUND(v_qty * v_price, 4),
                v_loc_id
            );
        END;
    END LOOP;

    -- 6. Physical Goods Receiving Integration (IF CONFIRMED)
    IF v_confirm_goods_received THEN
        v_receipt_number := 'GR-INV-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
        v_receipt_loc := COALESCE((v_items_array->0->>'location_id')::uuid, v_default_loc);

        INSERT INTO public.goods_receipts (
            restaurant_id, branch_id, supplier_id, location_id,
            purchase_order_id, receipt_number, received_at,
            invoice_number, status, total_cost,
            received_by_name, supplier_invoice_id
        ) VALUES (
            v_restaurant_id, v_branch_id, v_supplier_id, v_receipt_loc,
            v_po_id, v_receipt_number, now(),
            v_invoice_number, 'DRAFT', 0,
            v_created_by, v_invoice_id
        ) RETURNING id INTO v_receipt_id;

        -- Create Goods Receipt Items
        FOR v_item IN 
            SELECT 
                sii.id,
                sii.po_item_id,
                sii.item_id,
                sii.invoiced_quantity,
                COALESCE(sii.purchase_unit, 'pcs') AS purchase_unit,
                sii.unit_price,
                COALESCE(sii.base_unit, i.base_unit, sii.purchase_unit, 'pcs') AS effective_base_unit,
                COALESCE(sii.base_quantity, sii.invoiced_quantity, 1) AS effective_base_quantity,
                CASE 
                    WHEN COALESCE(sii.base_quantity, sii.invoiced_quantity, 1) > 0 
                    THEN ROUND((sii.invoiced_quantity * sii.unit_price) / COALESCE(sii.base_quantity, sii.invoiced_quantity, 1), 4)
                    ELSE sii.unit_price 
                END AS effective_base_unit_cost
            FROM public.supplier_invoice_items sii
            LEFT JOIN public.items i ON i.id = sii.item_id
            WHERE sii.invoice_id = v_invoice_id
        LOOP
            INSERT INTO public.goods_receipt_items (
                receipt_id, po_item_id, item_id, purchase_quantity,
                purchase_unit, purchase_unit_cost, base_quantity,
                base_unit, base_unit_cost, total_cost, invoice_item_id
            ) VALUES (
                v_receipt_id,
                v_item.po_item_id,
                v_item.item_id,
                v_item.invoiced_quantity,
                v_item.purchase_unit,
                v_item.unit_price,
                v_item.effective_base_quantity,
                v_item.effective_base_unit,
                v_item.effective_base_unit_cost,
                v_item.invoiced_quantity * v_item.unit_price,
                v_item.id
            );
        END LOOP;

        -- Call Unified Inventory Engine to Post Receipt
        v_receipt_res := public.process_goods_receipt(
            p_receipt_id => v_receipt_id,
            p_user_id => NULL,
            p_user_name => v_created_by,
            p_lot_allocations => NULL,
            p_allow_over_receipt_override => false,
            p_override_reason => NULL
        );

        IF NOT COALESCE((v_receipt_res->>'success')::boolean, false) THEN
            RAISE EXCEPTION 'GOODS_RECEIPT_FAILED: %', (v_receipt_res->>'message');
        END IF;
    END IF;

    -- 7. Immediate Settlement (IF PAY NOW CHECKED)
    IF v_pay_now AND (v_paid_usd > 0 OR v_paid_lbp > 0) THEN
        INSERT INTO public.supplier_payments (
            restaurant_id, branch_id, supplier_id, payment_date,
            payment_method, amount_usd, amount_lbp, exchange_rate,
            effective_total_usd, pos_shift_id, reference_number,
            notes, created_by, idempotency_key
        ) VALUES (
            v_restaurant_id, v_branch_id, v_supplier_id, v_invoice_date,
            v_payment_method, v_paid_usd, v_paid_lbp, v_exchange_rate,
            (v_paid_usd + (CASE WHEN v_exchange_rate > 0 THEN v_paid_lbp / v_exchange_rate ELSE 0 END)),
            v_shift_id, 'INV-' || v_invoice_number,
            'Immediate payment for Invoice ' || v_invoice_number,
            v_created_by, v_idempotency_key || ':PAY'
        ) RETURNING id INTO v_payment_id;

        -- Create Allocation
        INSERT INTO public.supplier_payment_allocations (
            payment_id, invoice_id, allocated_usd, allocated_lbp,
            exchange_rate, effective_allocated_usd
        ) VALUES (
            v_payment_id, v_invoice_id, v_paid_usd, v_paid_lbp,
            v_exchange_rate,
            (v_paid_usd + (CASE WHEN v_exchange_rate > 0 THEN v_paid_lbp / v_exchange_rate ELSE 0 END))
        );

        -- Update Invoice Payment Status
        UPDATE public.supplier_invoices
        SET paid_amount_usd = v_paid_usd,
            paid_amount_lbp = v_paid_lbp,
            payment_status = CASE 
                WHEN (v_paid_usd + (CASE WHEN v_exchange_rate > 0 THEN v_paid_lbp / v_exchange_rate ELSE 0 END)) >= (v_total_usd - 0.05) THEN 'PAID'
                ELSE 'PARTIALLY_PAID'
            END
        WHERE id = v_invoice_id;

        -- If Cash Outflow, invoke single authoritative cash procedure
        IF UPPER(v_payment_method) LIKE '%CASH%' AND v_shift_id IS NOT NULL THEN
            v_cash_res := public.post_drawer_cash_outflow(
                p_restaurant_id => v_restaurant_id,
                p_shift_id => v_shift_id,
                p_amount_usd => v_paid_usd,
                p_amount_lbp => v_paid_lbp,
                p_outflow_type => CASE WHEN v_is_direct_purchase THEN 'DIRECT_PURCHASE' ELSE 'SUPPLIER_PAYMENT' END,
                p_expense_category_code => 'COST_OF_GOODS',
                p_payee => (SELECT name FROM public.suppliers WHERE id = v_supplier_id),
                p_reason => 'Cash Settlement for Invoice #' || v_invoice_number,
                p_source_type => 'SUPPLIER_INVOICE',
                p_source_id => v_invoice_id,
                p_authorized_by => v_created_by,
                p_created_by => v_created_by,
                p_idempotency_key => v_idempotency_key || ':DRAWER'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'goods_receipt_id', v_receipt_id,
        'goods_receipt_number', v_receipt_number,
        'payment_id', v_payment_id,
        'total_usd', v_total_usd,
        'total_lbp', v_total_lbp,
        'receipt_status', CASE WHEN v_confirm_goods_received THEN 'FULLY_RECEIVED' ELSE 'NO_GOODS_RECEIVED' END,
        'payment_status', CASE WHEN v_pay_now THEN (SELECT payment_status FROM public.supplier_invoices WHERE id = v_invoice_id) ELSE 'UNPAID' END
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.settle_supplier_invoices(
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_restaurant_id UUID;
    v_branch_id TEXT;
    v_supplier_id UUID;
    v_payment_date DATE;
    v_payment_method TEXT;
    v_amount_usd NUMERIC;
    v_amount_lbp NUMERIC;
    v_exchange_rate NUMERIC;
    v_effective_total_usd NUMERIC;
    v_pos_shift_id UUID;
    v_reference_number TEXT;
    v_notes TEXT;
    v_created_by TEXT;
    v_idempotency_key TEXT;

    v_payment_id UUID;
    v_alloc_array JSONB;
    v_elem JSONB;
    v_inv RECORD;
    v_alloc_usd NUMERIC;
    v_alloc_lbp NUMERIC;
    v_effective_alloc_usd NUMERIC;
    v_current_paid_eff NUMERIC;
    v_cash_res JSONB;
    v_existing_pay_id UUID;
BEGIN
    v_restaurant_id := (p_payload->>'restaurant_id')::uuid;
    v_branch_id := p_payload->>'branch_id';
    v_supplier_id := (p_payload->>'supplier_id')::uuid;
    v_payment_date := COALESCE((p_payload->>'payment_date')::date, CURRENT_DATE);
    v_payment_method := p_payload->>'payment_method';
    v_amount_usd := COALESCE((p_payload->>'amount_usd')::numeric, (p_payload->>'paid_amount_usd')::numeric, 0);
    v_amount_lbp := COALESCE((p_payload->>'amount_lbp')::numeric, (p_payload->>'paid_amount_lbp')::numeric, 0);
    v_exchange_rate := COALESCE((p_payload->>'exchange_rate')::numeric, 1.0);
    v_pos_shift_id := (p_payload->>'shift_id')::uuid;
    v_reference_number := p_payload->>'reference_number';
    v_notes := p_payload->>'notes';
    v_created_by := COALESCE(p_payload->>'created_by', p_payload->>'user_name', 'POS Cashier');
    v_idempotency_key := p_payload->>'idempotency_key';

    -- Normalize payment method to enum ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER')
    IF UPPER(COALESCE(v_payment_method, 'CASH')) LIKE '%CASH%' THEN
        v_payment_method := 'CASH';
    ELSIF UPPER(v_payment_method) LIKE '%BANK%' THEN
        v_payment_method := 'BANK_TRANSFER';
    ELSIF UPPER(v_payment_method) LIKE '%CHEQUE%' OR UPPER(v_payment_method) LIKE '%CHECK%' THEN
        v_payment_method := 'CHEQUE';
    ELSIF UPPER(v_payment_method) LIKE '%CARD%' THEN
        v_payment_method := 'CARD';
    ELSE
        v_payment_method := 'OTHER';
    END IF;

    IF v_amount_usd <= 0 AND v_amount_lbp <= 0 THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_REQUIRED: Must provide positive amount in USD or LBP';
    END IF;

    -- Idempotency Check
    IF v_idempotency_key IS NOT NULL AND v_idempotency_key <> '' THEN
        SELECT id INTO v_existing_pay_id 
        FROM public.supplier_payments 
        WHERE idempotency_key = v_idempotency_key 
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'IDEMPOTENT_NOOP',
                'message', 'Payment already processed for this idempotency key',
                'payment_id', v_existing_pay_id
            );
        END IF;
    END IF;

    v_effective_total_usd := v_amount_usd + (CASE WHEN v_exchange_rate > 0 THEN v_amount_lbp / v_exchange_rate ELSE 0 END);

    -- 1. Insert Payment Header
    INSERT INTO public.supplier_payments (
        restaurant_id, branch_id, supplier_id, payment_date,
        payment_method, amount_usd, amount_lbp, exchange_rate,
        effective_total_usd, pos_shift_id, reference_number,
        notes, created_by, idempotency_key
    ) VALUES (
        v_restaurant_id, v_branch_id, v_supplier_id, v_payment_date,
        v_payment_method, v_amount_usd, v_amount_lbp, v_exchange_rate,
        v_effective_total_usd, v_pos_shift_id, v_reference_number,
        v_notes, v_created_by, v_idempotency_key
    ) RETURNING id INTO v_payment_id;

    -- 2. Process Allocations
    v_alloc_array := p_payload->'allocations';
    IF v_alloc_array IS NOT NULL AND jsonb_array_length(v_alloc_array) > 0 THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_alloc_array)
        LOOP
            v_alloc_usd := COALESCE((v_elem->>'allocated_usd')::numeric, 0);
            v_alloc_lbp := COALESCE((v_elem->>'allocated_lbp')::numeric, 0);
            v_effective_alloc_usd := v_alloc_usd + (CASE WHEN v_exchange_rate > 0 THEN v_alloc_lbp / v_exchange_rate ELSE 0 END);

            SELECT * INTO v_inv 
            FROM public.supplier_invoices 
            WHERE id = (v_elem->>'invoice_id')::uuid 
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'INVOICE_NOT_FOUND: Invoice % does not exist', (v_elem->>'invoice_id');
            END IF;

            -- Insert allocation line
            INSERT INTO public.supplier_payment_allocations (
                payment_id, invoice_id, allocated_usd, allocated_lbp,
                exchange_rate, effective_allocated_usd
            ) VALUES (
                v_payment_id, v_inv.id, v_alloc_usd, v_alloc_lbp,
                v_exchange_rate, v_effective_alloc_usd
            );

            -- Update invoice paid totals
            UPDATE public.supplier_invoices
            SET paid_amount_usd = paid_amount_usd + v_alloc_usd,
                paid_amount_lbp = paid_amount_lbp + v_alloc_lbp,
                payment_status = CASE
                    WHEN (paid_amount_usd + v_alloc_usd + (CASE WHEN v_exchange_rate > 0 THEN (paid_amount_lbp + v_alloc_lbp) / v_exchange_rate ELSE 0 END)) >= (total_amount_usd - 0.05) THEN 'PAID'
                    ELSE 'PARTIALLY_PAID'
                END,
                updated_at = now()
            WHERE id = v_inv.id;
        END LOOP;
    END IF;

    -- 3. If Cash Payment, invoke single authoritative drawer outflow
    IF UPPER(v_payment_method) LIKE '%CASH%' AND v_pos_shift_id IS NOT NULL THEN
        v_cash_res := public.post_drawer_cash_outflow(
            p_restaurant_id => v_restaurant_id,
            p_shift_id => v_pos_shift_id,
            p_amount_usd => v_amount_usd,
            p_amount_lbp => v_amount_lbp,
            p_outflow_type => 'SUPPLIER_PAYMENT',
            p_expense_category_code => 'COST_OF_GOODS',
            p_payee => (SELECT name FROM public.suppliers WHERE id = v_supplier_id),
            p_reason => COALESCE(v_notes, 'Supplier invoice settlement: ' || (SELECT name FROM public.suppliers WHERE id = v_supplier_id)),
            p_source_type => 'SUPPLIER_PAYMENT',
            p_source_id => v_payment_id,
            p_authorized_by => v_created_by,
            p_created_by => v_created_by,
            p_idempotency_key => v_idempotency_key || ':DRAWER'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'amount_usd', v_amount_usd,
        'amount_lbp', v_amount_lbp,
        'effective_total_usd', v_effective_total_usd,
        'payment_method', v_payment_method,
        'message', 'Payment recorded and allocated successfully with zero inventory changes'
    );
END;
$$;
  `);
  console.log('Both RPCs patched successfully.');
  await sql.end();
}

patch().catch(err => {
  console.error('Patch error:', err);
  process.exit(1);
});
