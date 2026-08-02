import { localCartStore } from "./localCartStore";
import { apiFetch } from "./apiFetch";
import { getAuthPhone } from "./auth/getAuthPhone";

/**
 * Migrates anonymous cart from local storage to server after sign-in
 * This ensures cart items persist when a user signs in at checkout
 */

// Prevent duplicate migrations firing at the same time (e.g. cart + checkout screens)
const migrationInFlightByBranch = new Map();

export async function migrateAnonymousCart(branchId) {
  const branchKey = branchId ? String(branchId) : "__all__";

  if (migrationInFlightByBranch.get(branchKey)) {
    console.log("[CART MIGRATION] Migration already in flight for:", branchKey);
    return migrationInFlightByBranch.get(branchKey);
  }

  const run = (async () => {
    try {
      console.log(
        "[CART MIGRATION] Starting cart migration for branch:",
        branchId,
      );

      const allCarts = await localCartStore.getAllCarts();

      if (!allCarts || Object.keys(allCarts).length === 0) {
        return { success: true, itemsMigrated: 0, itemsRemaining: 0 };
      }

      const cartsToMigrate = branchId
        ? { [String(branchId)]: allCarts[String(branchId)] }
        : allCarts;

      if (!cartsToMigrate || Object.keys(cartsToMigrate).length === 0) {
        return { success: true, itemsMigrated: 0, itemsRemaining: 0 };
      }

      // Auth: JWT via apiFetch, phone optional
      const phone = await getAuthPhone();

      let totalItemsMigrated = 0;
      let totalItemsRemaining = 0;

      for (const [currentBranchId, items] of Object.entries(cartsToMigrate)) {
        const safeItems = Array.isArray(items) ? items : [];
        if (safeItems.length === 0) {
          continue;
        }

        const remainingForBranch = [];

        for (const item of safeItems) {
          try {
            const desiredQty = Number(item.quantity || 0);
            if (!Number.isFinite(desiredQty) || desiredQty < 1) {
              continue;
            }

            const normalizedComment =
              item?.comment === null || item?.comment === undefined
                ? null
                : String(item.comment).trim() || null;

            const requestBody = {
              product_id: item.product_id,
              branch_id: parseInt(currentBranchId, 10),
              quantity: desiredQty,
              customizations: item.customizations || [],
              comment: normalizedComment,
              ...(phone ? { phone } : {}),
            };

            const response = await apiFetch("/api/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            if (response.ok) {
              totalItemsMigrated++;
              continue;
            }

            // If stock is limited, migrate what we can and keep the remainder locally
            if (response.status === 409) {
              const err = await response.json().catch(() => ({}));
              const maxAdditionalRaw = err?.max_additional;
              const maxAdditional = Number(maxAdditionalRaw);

              if (Number.isFinite(maxAdditional) && maxAdditional > 0) {
                const qtyToMigrate = Math.min(desiredQty, maxAdditional);
                const remainingQty = desiredQty - qtyToMigrate;

                const secondResp = await apiFetch("/api/cart", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...requestBody,
                    quantity: qtyToMigrate,
                  }),
                });

                if (secondResp.ok) {
                  totalItemsMigrated++;

                  if (remainingQty > 0) {
                    remainingForBranch.push({
                      ...item,
                      quantity: remainingQty,
                    });
                  }
                  continue;
                }
              }

              // Could not migrate (0 available or second attempt failed)
              remainingForBranch.push(item);
              continue;
            }

            // Any other error: keep the item locally
            const errorData = await response.json().catch(() => ({}));
            console.error(
              "[CART MIGRATION] Failed to migrate item:",
              errorData,
            );
            remainingForBranch.push(item);
          } catch (error) {
            console.error("[CART MIGRATION] Error migrating item:", error);
            remainingForBranch.push(item);
          }
        }

        // Only clear what we migrated. Keep any remaining items so the user never "loses" their cart.
        if (remainingForBranch.length === 0) {
          await localCartStore.clearCart(currentBranchId);
        } else {
          totalItemsRemaining += remainingForBranch.length;
          await localCartStore.setCart(currentBranchId, remainingForBranch);
        }
      }

      return {
        success: true,
        itemsMigrated: totalItemsMigrated,
        itemsRemaining: totalItemsRemaining,
      };
    } catch (error) {
      console.error("[CART MIGRATION] ❌ Migration failed:", error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      migrationInFlightByBranch.delete(branchKey);
    }
  })();

  migrationInFlightByBranch.set(branchKey, run);
  return run;
}
