-- ======================================================================================
-- Migration: Grant EXECUTE on allocate_concept_invoice_number to anon role
-- Context:
--   Standalone POS terminals authenticate via PIN-based login and invoke Supabase RPCs
--   using the publishable anon role (consistent with create_order_tender_receivable and
--   process_sale_inventory_deduction). Revoking EXECUTE from anon caused POS orders to
--   complete without an allocated invoice_number, showing as "(Draft)" in Web Admin.
-- ======================================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.allocate_concept_invoice_number(bigint, text, text) TO anon, authenticated, service_role;

COMMIT;
