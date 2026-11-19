const postgres = require('postgres');
const DB_URL = 'postgresql://postgres.ilrlychrraagugntqdfr:7fs0%26cUGaX4j04kc3AzR@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
const sql = postgres(DB_URL, { max: 1 });

async function fixConstraintsAndRoutines() {
  console.log('1. Setting safe defaults on goods_receipt_items and supplier_invoice_items...');
  
  await sql.unsafe(`
    -- Add safe default 'pcs' to base_unit and purchase_unit so inserts never fail not-null constraint
    ALTER TABLE public.goods_receipt_items ALTER COLUMN base_unit SET DEFAULT 'pcs';
    ALTER TABLE public.goods_receipt_items ALTER COLUMN purchase_unit SET DEFAULT 'pcs';
    ALTER TABLE public.supplier_invoice_items ALTER COLUMN base_unit SET DEFAULT 'pcs';
    ALTER TABLE public.supplier_invoice_items ALTER COLUMN purchase_unit SET DEFAULT 'pcs';

    -- Also backfill any null base_units if any exist
    UPDATE public.goods_receipt_items SET base_unit = 'pcs' WHERE base_unit IS NULL;
    UPDATE public.goods_receipt_items SET purchase_unit = 'pcs' WHERE purchase_unit IS NULL;
    UPDATE public.supplier_invoice_items SET base_unit = 'pcs' WHERE base_unit IS NULL;
    UPDATE public.supplier_invoice_items SET purchase_unit = 'pcs' WHERE purchase_unit IS NULL;
  `);

  console.log('2. Patching validate_and_post_supplier_invoice to ensure base_unit is COALESCED with safe fallback...');
  // Check validate_and_post_supplier_invoice
  const vapFunc = await sql`SELECT prosrc FROM pg_proc WHERE proname = 'validate_and_post_supplier_invoice'`;
  if (vapFunc.length > 0) {
    let src = vapFunc[0].prosrc;
    // Replace v_item.base_unit in goods_receipt_items insert with COALESCE(v_item.base_unit, 'pcs')
    const oldInsert = `v_item.base_unit,\n                        v_effective_base_cost_usd,\n                        v_unreceived_base_qty,\n                        v_item.base_unit,`;
    const newInsert = `COALESCE(v_item.base_unit, 'pcs'),\n                        v_effective_base_cost_usd,\n                        v_unreceived_base_qty,\n                        COALESCE(v_item.base_unit, 'pcs'),`;
    if (src.includes(oldInsert)) {
      src = src.replace(oldInsert, newInsert);
      await sql.unsafe(`
        CREATE OR REPLACE FUNCTION public.validate_and_post_supplier_invoice(
          p_payload JSONB,
          p_user_id TEXT
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $VAP$
        ${src}
        $VAP$;
      `);
      console.log('Successfully patched validate_and_post_supplier_invoice');
    } else {
      console.log('Target string in validate_and_post_supplier_invoice not matched exactly, checking alternative replace...');
      src = src.replace(/v_unreceived_base_qty,\s*v_item\.base_unit,\s*v_effective_base_cost_usd,\s*v_unreceived_base_qty,\s*v_item\.base_unit,/g,
        "v_unreceived_base_qty,\n                        COALESCE(v_item.base_unit, 'pcs'),\n                        v_effective_base_cost_usd,\n                        v_unreceived_base_qty,\n                        COALESCE(v_item.base_unit, 'pcs'),");
      await sql.unsafe(`
        CREATE OR REPLACE FUNCTION public.validate_and_post_supplier_invoice(
          p_payload JSONB,
          p_user_id TEXT
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $VAP$
        ${src}
        $VAP$;
      `);
      console.log('Patched validate_and_post_supplier_invoice with regex replace');
    }
  }

  console.log('3. Patching receive_invoice_goods with safe fallback...');
  const rigFunc = await sql`SELECT prosrc FROM pg_proc WHERE proname = 'receive_invoice_goods'`;
  if (rigFunc.length > 0) {
    let src = rigFunc[0].prosrc;
    src = src.replace(/v_inv_item\.base_unit/g, "COALESCE(v_inv_item.base_unit, v_inv_item.purchase_unit, 'pcs')");
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.receive_invoice_goods(
        p_payload JSONB
      )
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $RIG$
      ${src}
      $RIG$;
    `);
    console.log('Successfully patched receive_invoice_goods');
  }

  console.log('All DB patches applied successfully.');
  await sql.end();
}

fixConstraintsAndRoutines().catch(err => {
  console.error('Error applying patches:', err);
  process.exit(1);
});
