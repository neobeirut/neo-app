import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localCartStore } from "../utils/localCartStore";
import { serverCartBackupStore } from "../utils/serverCartBackupStore";
import { apiFetch } from "../utils/apiFetch";
import { getAuthPhone } from "../utils/auth/getAuthPhone";
import { migrateAnonymousCart } from "../utils/migrateAnonymousCart";

export function useCartData(selectedBranch, isAuthenticated, isReady = true) {
  const queryClient = useQueryClient();

  // Normalize auth to a real boolean for query keys (prevents accidental key splits)
  const isAuth = !!isAuthenticated;
  const authReady = !!isReady;
  const key = ["cart", selectedBranch?.id, isAuth];

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      console.log("[useCartData] ========== FETCHING CART ==========");
      console.log("[useCartData] selectedBranch:", selectedBranch?.id);
      console.log("[useCartData] isAuth:", isAuth);
      console.log("[useCartData] authReady:", authReady);

      if (!selectedBranch) {
        console.log("[useCartData] No branch selected");
        return { cart_items: [] };
      }

      // EXTRA SAFETY (fixes cart "reset" during AUTH LOADING only):
      // If auth isn't ready yet (isReady=false), we may temporarily treat the
      // user as unauthenticated. In that narrow case, preserve a non-empty
      // authenticated cart cache instead of briefly showing an empty local cart.
      //
      // IMPORTANT: do NOT do this when authReady=true and isAuth=false, because
      // that would show a stale signed-in cart for truly signed-out users.
      if (!isAuth && !authReady) {
        const authKey = ["cart", selectedBranch.id, true];
        const cachedAuth = queryClient.getQueryData(authKey);
        const cachedAuthItems = cachedAuth?.cart_items || [];
        if (cachedAuthItems.length > 0) {
          console.warn(
            "[CART] Auth still loading; preserving cached authenticated cart to avoid flicker",
          );

          setTimeout(() => {
            queryClient
              .refetchQueries({ queryKey: authKey, type: "active" })
              .catch(() => {});
          }, 600);

          return cachedAuth;
        }
      }

      // For anonymous users, fetch from local storage
      if (!isAuth) {
        const localItems = await localCartStore.getCart(selectedBranch.id);
        console.log(
          "[useCartData] Anonymous user - local items count:",
          localItems?.length || 0,
        );
        return { cart_items: localItems };
      }

      // If we have an anonymous cart for this branch, migrate it first so the cart doesn't "reset" after sign-in.
      // This is safe to call multiple times (the migration util is idempotent).
      // IMPORTANT: only migrate from the anonymous cart store (NOT from the signed-in backup store).
      const localItemsBefore = await localCartStore.getCart(selectedBranch.id);
      if (localItemsBefore.length > 0) {
        await migrateAnonymousCart(selectedBranch.id);
      }

      // For authenticated users, fetch from server (JWT via apiFetch, phone optional)
      const phone = await getAuthPhone();
      console.log("[useCartData] Phone:", phone ? "Present" : "Missing");

      const params = new URLSearchParams({ branch_id: selectedBranch.id });
      if (phone) params.append("phone", phone);

      console.log(
        "[useCartData] Fetching from:",
        `/api/cart?${params.toString()}`,
      );

      let response;
      try {
        response = await apiFetch(`/api/cart?${params.toString()}`);
        console.log(
          "[useCartData] Response status:",
          response.status,
          response.ok ? "OK" : "ERROR",
        );
      } catch (error) {
        console.error("[useCartData] ❌ Fetch failed:", error.message);
        // Network / CORS issue (common in web preview) -> fall back safely.
        // IMPORTANT: do NOT overwrite a non-empty cached cart with an empty cart.
        console.error(
          "[CART] Failed to fetch server cart, falling back to backup/cached cart",
          error,
        );

        const backupItems = await serverCartBackupStore.getCart(
          selectedBranch.id,
        );
        if (backupItems.length > 0) {
          return { cart_items: backupItems };
        }

        const cached = queryClient.getQueryData(key);
        const cachedItems = cached?.cart_items || [];
        if (cachedItems.length > 0) {
          console.warn(
            "[CART] Server cart fetch threw; preserving cached cart to avoid reset",
          );
          return cached;
        }

        return { cart_items: [] };
      }

      if (!response.ok) {
        const backupItems = await serverCartBackupStore.getCart(
          selectedBranch.id,
        );
        if (backupItems.length > 0) {
          return { cart_items: backupItems };
        }

        // Also preserve cached auth cart if we have it.
        const cached = queryClient.getQueryData(key);
        const cachedItems = cached?.cart_items || [];
        if (cachedItems.length > 0) {
          console.warn(
            "[CART] Server cart fetch failed; preserving cached cart to avoid reset",
          );
          return cached;
        }

        return { cart_items: [] };
      }

      const data = await response.json().catch(() => null);
      const cartItems = data?.cart_items;

      // Defensively parse customizations if they are returned as string
      if (Array.isArray(cartItems)) {
        cartItems.forEach((item) => {
          if (typeof item.customizations === "string") {
            try {
              item.customizations = JSON.parse(item.customizations);
            } catch (e) {
              console.error("[useCartData] Failed to parse customizations string:", e);
              item.customizations = [];
            }
          }
          if (!Array.isArray(item.customizations)) {
            item.customizations = [];
          }
        });
      }
      const isUnauth = !!data?.unauthenticated;

      console.log("[useCartData] ✅ Cart fetched successfully:");
      console.log("[useCartData] - Items count:", cartItems?.length || 0);
      console.log("[useCartData] - Is unauthenticated:", isUnauth);

      // ✅ iOS DEBUG: Log first item structure
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        const item = cartItems[0];
        console.log("[useCartData] - First item:", {
          id: item.id,
          name: item.name,
          has_addons: Array.isArray(item.addons),
          addons_count: Array.isArray(item.addons) ? item.addons.length : 0,
          addons_sample: item.addons?.[0],
          has_customizations: Array.isArray(item.customizations),
          customizations_count: Array.isArray(item.customizations)
            ? item.customizations.length
            : 0,
          customizations_sample: item.customizations?.[0],
        });
      }

      // Helpful debugging in preview/emulator: backend returns `debug` in non-prod.
      if (data?.debug) {
        console.log("[CART] Backend debug:", data.debug);
      }

      // CRITICAL BUG FIX (v2):
      // If the backend can't resolve the user (common if auth/phone isn't available yet),
      // it returns { unauthenticated: true, cart_items: [] }.
      // In that case, NEVER show an empty cart if we still have items backed up locally.
      if (isUnauth) {
        const backupItems = await serverCartBackupStore.getCart(
          selectedBranch.id,
        );
        if (backupItems.length > 0) {
          console.warn(
            "[CART] Backend returned unauthenticated; preserving backup cart items to avoid apparent cart wipe",
          );

          setTimeout(() => {
            queryClient
              .refetchQueries({ queryKey: key, type: "active" })
              .catch(() => {});
          }, 600);

          return { cart_items: backupItems };
        }

        const cached = queryClient.getQueryData(key);
        const cachedItems = cached?.cart_items || [];

        if (cachedItems.length > 0) {
          console.warn(
            "[CART] Backend returned unauthenticated cart response; preserving cached cart to avoid reset",
          );

          setTimeout(() => {
            queryClient
              .refetchQueries({ queryKey: key, type: "active" })
              .catch(() => {});
          }, 600);

          return cached;
        }

        return { cart_items: [] };
      }

      // Normal success path
      if (!Array.isArray(cartItems)) {
        return { cart_items: [] };
      }

      // Keep a backup copy of the server cart, so if the server temporarily fails later
      // we can still show the last known-good cart instead of an empty state.
      try {
        await serverCartBackupStore.setCart(selectedBranch.id, cartItems);
      } catch (e) {
        console.warn("[CART] Failed to write backup cart:", e?.message);
      }

      return { cart_items: cartItems };
    },
    select: (data) => {
      if (!data || !Array.isArray(data.cart_items)) return data;
      return {
        ...data,
        cart_items: data.cart_items.map((item) => {
          if (!item) return item;
          let customizations = item.customizations;
          if (typeof customizations === "string") {
            try {
              customizations = JSON.parse(customizations);
            } catch (e) {
              console.error("[useCartData] select parsing failed:", e);
              customizations = [];
            }
          }
          return {
            ...item,
            customizations: Array.isArray(customizations) ? customizations : [],
          };
        }),
      };
    },
    enabled: !!selectedBranch,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    refetchInterval: false,
  });
}
