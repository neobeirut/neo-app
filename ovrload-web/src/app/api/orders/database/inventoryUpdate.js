import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";
import { applyInventoryStatusRule } from "../utils/inventoryHelpers";

export async function deductInventory({
  request,
  createdOrderId,
  effectiveBranchId,
  lineItems,
  clientName,
}) {
  try {
    const deductionItems = (lineItems || [])
      .map((it) => ({
        source_line_id: String(it.source_line_id || it.id || ""),
        product_id: Number(it.product_id),
        quantity: Number(it.quantity || 1),
        name: it.name || "Item",
        unit_price: Number(it.unit_price || 0),
        customizations: it.customizations || it.customizations_json || [],
      }))
      .filter((it) => !isNaN(it.product_id) && it.product_id > 0 && it.source_line_id);

    if (deductionItems.length === 0) {
      return { ok: true };
    }

    const [result] = await sql`
      SELECT public.process_sale_inventory_deduction(
        ${String(createdOrderId)},
        'MOBILE_ORDER',
        ${String(effectiveBranchId)},
        ${sql.json(deductionItems)},
        NULL,
        ${clientName || 'Mobile Customer'}
      ) as res
    `;

    const data = result?.res;
    if (data && data.success === false) {
      if (data.code === 'INSUFFICIENT_STOCK') {
        return {
          ok: false,
          response: corsJson(
            request,
            {
              error: data.error || 'Insufficient stock',
              code: 'INSUFFICIENT_STOCK',
              items: [
                {
                  product_id: data.product_id,
                  requested: data.requested,
                  available: data.available,
                },
              ],
            },
            { status: 409 },
          ),
        };
      }
      return {
        ok: false,
        response: corsJson(
          request,
          { error: data.error || 'Inventory deduction failed' },
          { status: 500 },
        ),
      };
    }

    return { ok: true, data };
  } catch (error) {
    console.error('[deductInventory] Unified inventory engine call failed:', error);
    return {
      ok: false,
      response: corsJson(
        request,
        { error: error.message || 'Inventory update failed' },
        { status: 500 },
      ),
    };
  }
}
