import sql from "@/app/api/utils/sql";
import { corsJson } from "@/app/api/utils/cors";
import { applyInventoryStatusRule } from "../utils/inventoryHelpers";

export async function deductInventory({
  request,
  inventoryDeductions,
  effectiveBranchId,
}) {
  for (const d of inventoryDeductions) {
    const [existingPbs] = await sql`
      SELECT id, status, quantity_on_hand
      FROM product_branch_status
      WHERE product_id = ${d.product_id} AND branch_id = ${effectiveBranchId}
    `;

    if (!existingPbs) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: "Insufficient stock",
            code: "INSUFFICIENT_STOCK",
            items: [
              {
                product_id: d.product_id,
                requested: d.quantity,
                available: 0,
              },
            ],
          },
          { status: 409 },
        ),
      };
    }

    const currentQoh =
      existingPbs.quantity_on_hand === null ||
      existingPbs.quantity_on_hand === undefined
        ? 0
        : Number(existingPbs.quantity_on_hand);

    if (d.quantity > currentQoh) {
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: "Insufficient stock",
            code: "INSUFFICIENT_STOCK",
            items: [
              {
                product_id: d.product_id,
                requested: d.quantity,
                available: currentQoh,
              },
            ],
          },
          { status: 409 },
        ),
      };
    }

    const nextQoh = currentQoh - d.quantity;
    const nextStatus = applyInventoryStatusRule(existingPbs.status, nextQoh);

    await sql`
      UPDATE product_branch_status
      SET quantity_on_hand = ${nextQoh},
          status = ${nextStatus},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existingPbs.id}
    `;
  }

  return { ok: true };
}
