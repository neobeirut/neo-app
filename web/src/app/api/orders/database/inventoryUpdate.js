import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";
import { applyInventoryStatusRule } from "../utils/inventoryHelpers";

export async function deductInventory({
  request,
  createdOrderId,
  effectiveBranchId,
  lineItems,
  inventoryDeductions,
}) {
  try {
    const itemsToDeduct = lineItems || inventoryDeductions || [];

    for (const it of itemsToDeduct) {
      const productId = Number(it.product_id);
      const quantity = Number(it.quantity || 1);

      if (!productId || isNaN(productId) || quantity <= 0) {
        continue;
      }

      // Check if product has inventory tracking enabled
      const [product] = await sql`
        SELECT inventory_applies FROM products WHERE id = ${productId}
      `;

      if (!product || !product.inventory_applies) {
        continue;
      }

      const [existingPbs] = await sql`
        SELECT id, status, quantity_on_hand
        FROM product_branch_status
        WHERE product_id = ${productId} AND branch_id = ${Number(effectiveBranchId)}
      `;

      if (existingPbs) {
        const currentQoh =
          existingPbs.quantity_on_hand === null ||
          existingPbs.quantity_on_hand === undefined
            ? 0
            : Number(existingPbs.quantity_on_hand);

        const nextQoh = Math.max(0, currentQoh - quantity);
        const nextStatus = applyInventoryStatusRule(existingPbs.status, nextQoh);

        await sql`
          UPDATE product_branch_status
          SET quantity_on_hand = ${nextQoh},
              status = ${nextStatus},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingPbs.id}
        `;
      }
    }

    return { ok: true };
  } catch (error) {
    console.error("[deductInventory] Inventory update error (non-fatal):", error);
    // Don't fail the order if secondary inventory update has a non-critical error
    return { ok: true };
  }
}
