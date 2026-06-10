import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const LEGACY_ASYNC_KEY = "anonymous_cart";
const SECURE_INDEX_KEY = "anonymous_cart_v2_index";
const SECURE_MIGRATED_FLAG_KEY = "anonymous_cart_v2_migrated";
const SECURE_BRANCH_KEY_PREFIX = "anonymous_cart_v2_branch_";

// IMPORTANT:
// Using Date.now() alone can generate duplicate ids if two items are added in the
// same millisecond. Duplicate ids can cause React list rendering bugs (items
// appearing merged or quantities jumping).
let localIdCounter = 0;
const generateLocalCartItemId = () => {
  localIdCounter = (localIdCounter + 1) % 1000;
  return Date.now() * 1000 + localIdCounter;
};

const safeParseJson = (raw, fallback) => {
  try {
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

const normalizeBranchId = (branchId) => {
  if (branchId === null || branchId === undefined) {
    return null;
  }
  const str = String(branchId);
  return str.trim() ? str.trim() : null;
};

// NEW: stable normalization so "same product, different options" never merges by accident.
const normalizeCustomizations = (customizations) => {
  const list = Array.isArray(customizations) ? customizations : [];
  return list
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const id = Number(c.id);
      if (!Number.isFinite(id)) return null;
      const typeRaw = c.type || c.customization_type;
      const type =
        typeRaw === null || typeRaw === undefined ? "" : String(typeRaw);
      const ingredient =
        c.ingredient === null || c.ingredient === undefined
          ? null
          : String(c.ingredient);
      const option_group_name =
        c.option_group_name === null || c.option_group_name === undefined
          ? null
          : String(c.option_group_name);
      const priceNum = Number(c.price || 0);
      const price = Number.isFinite(priceNum) ? priceNum : 0;
      return { id, type, ingredient, option_group_name, price };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const t = String(a.type).localeCompare(String(b.type));
      if (t !== 0) return t;
      const g = String(a.option_group_name || "").localeCompare(
        String(b.option_group_name || ""),
      );
      if (g !== 0) return g;
      return a.id - b.id;
    });
};

const normalizeAddonIdsFromObjects = (addons) => {
  const list = Array.isArray(addons) ? addons : [];
  const ids = list
    .map((a) => Number(a?.addon_id ?? a?.id ?? a?.product_addon_id))
    .filter((x) => Number.isFinite(x));
  return Array.from(new Set(ids)).sort((a, b) => a - b);
};

const normalizeComment = (comment) => {
  return comment === null || comment === undefined
    ? null
    : String(comment).trim() || null;
};

const getCartLineSignature = ({
  product_id,
  customizations,
  addons,
  comment,
}) => {
  return JSON.stringify({
    product_id: Number(product_id),
    customizations: normalizeCustomizations(customizations),
    addon_ids: normalizeAddonIdsFromObjects(addons),
    comment: normalizeComment(comment),
  });
};

async function getSecureIndex() {
  const raw = await SecureStore.getItemAsync(SECURE_INDEX_KEY);
  const idx = safeParseJson(raw, []);
  return Array.isArray(idx) ? idx.map(String) : [];
}

async function setSecureIndex(nextIndex) {
  const unique = Array.from(new Set((nextIndex || []).map(String)));
  await SecureStore.setItemAsync(SECURE_INDEX_KEY, JSON.stringify(unique));
  return unique;
}

async function ensureMigratedToSecureStore() {
  try {
    const migrated = await SecureStore.getItemAsync(SECURE_MIGRATED_FLAG_KEY);
    if (migrated === "1") {
      return;
    }

    const legacyRaw = await AsyncStorage.getItem(LEGACY_ASYNC_KEY);
    const legacyAllCarts = safeParseJson(legacyRaw, null);

    if (legacyAllCarts && typeof legacyAllCarts === "object") {
      const index = [];

      for (const [branchId, items] of Object.entries(legacyAllCarts)) {
        const b = normalizeBranchId(branchId);
        if (!b) {
          continue;
        }

        const safeItems = Array.isArray(items) ? items : [];
        if (safeItems.length === 0) {
          continue;
        }

        // Store per-branch to keep SecureStore values small
        await SecureStore.setItemAsync(
          `${SECURE_BRANCH_KEY_PREFIX}${b}`,
          JSON.stringify(safeItems),
        );
        index.push(b);
      }

      await setSecureIndex(index);

      // Clear legacy storage after successful migration
      await AsyncStorage.removeItem(LEGACY_ASYNC_KEY);
    }

    await SecureStore.setItemAsync(SECURE_MIGRATED_FLAG_KEY, "1");
  } catch (error) {
    // If secure storage fails for any reason, do NOT block the app.
    console.error("[LOCAL CART] SecureStore migration failed:", error);
  }
}

/**
 * Local cart storage for anonymous users
 * Stores cart items before sign-in
 *
 * NOTE: We store cart data in SecureStore (encrypted on-device) for better
 * App Store compliance (Guideline 5.1.1(vi)).
 */
export const localCartStore = {
  /**
   * Get cart items for a specific branch
   */
  async getCart(branchId) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const raw = await SecureStore.getItemAsync(
        `${SECURE_BRANCH_KEY_PREFIX}${b}`,
      );
      const items = safeParseJson(raw, []);
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.error("[LOCAL CART] Error getting cart:", error);
      return [];
    }
  },

  /**
   * Replace the cart for a specific branch (used for partial migration)
   */
  async setCart(branchId, items) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const safeItems = Array.isArray(items) ? items : [];
      const key = `${SECURE_BRANCH_KEY_PREFIX}${b}`;

      const index = await getSecureIndex();

      if (safeItems.length === 0) {
        await SecureStore.deleteItemAsync(key);
        const nextIndex = index.filter((x) => x !== b);
        await setSecureIndex(nextIndex);
        return [];
      }

      await SecureStore.setItemAsync(key, JSON.stringify(safeItems));
      if (!index.includes(b)) {
        await setSecureIndex([...index, b]);
      }

      return safeItems;
    } catch (error) {
      console.error("[LOCAL CART] Error setting cart:", error);
      throw error;
    }
  },

  /**
   * Add or update item in cart
   */
  async addItem(branchId, item) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const current = await this.getCart(b);
      const next = Array.isArray(current) ? [...current] : [];

      const normalizedComment = normalizeComment(item?.comment);

      const incomingSig = getCartLineSignature({
        product_id: item.product_id,
        customizations: item.customizations,
        addons: item.addons,
        comment: normalizedComment,
      });

      // Check if item already exists (same product + same options/add-ons + same note)
      const existingIndex = next.findIndex((cartItem) => {
        const cartSig = getCartLineSignature({
          product_id: cartItem.product_id,
          customizations: cartItem.customizations,
          addons: cartItem.addons,
          comment: cartItem.comment,
        });
        return cartSig === incomingSig;
      });

      if (existingIndex >= 0) {
        // Update quantity
        next[existingIndex].quantity += item.quantity;

        // If we have richer product details coming in, keep them
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          ...item,
          comment: normalizedComment,
          quantity: existing.quantity,
        };
      } else {
        // Add new item
        next.push({
          id: generateLocalCartItemId(),
          ...item,
          comment: normalizedComment,
          name: item?.name || "Product",
          price:
            item?.price === null || item?.price === undefined ? 0 : item.price,
          image_url: item?.image_url || null,
        });
      }

      await this.setCart(b, next);
      return next;
    } catch (error) {
      console.error("[LOCAL CART] Error adding item:", error);
      throw error;
    }
  },

  /**
   * Update item quantity
   */
  async updateItem(branchId, itemId, quantity) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const current = await this.getCart(b);
      const next = Array.isArray(current) ? [...current] : [];

      const itemIndex = next.findIndex(
        (it) => Number(it.id) === Number(itemId),
      );

      if (itemIndex >= 0) {
        if (quantity <= 0) {
          next.splice(itemIndex, 1);
        } else {
          next[itemIndex].quantity = quantity;
        }
      }

      await this.setCart(b, next);
      return next;
    } catch (error) {
      console.error("[LOCAL CART] Error updating item:", error);
      throw error;
    }
  },

  /**
   * Update item details (customizations/comment/addons/quantity) for anonymous users.
   */
  async updateItemDetails(branchId, itemId, updates) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const current = await this.getCart(b);
      const next = Array.isArray(current) ? [...current] : [];

      const idx = next.findIndex((it) => Number(it.id) === Number(itemId));
      if (idx < 0) {
        return next;
      }

      const item = { ...next[idx] };

      // ✅ NEW: Support quantity updates
      if (
        updates &&
        Object.prototype.hasOwnProperty.call(updates, "quantity")
      ) {
        const qty = Number(updates.quantity);
        if (Number.isFinite(qty) && qty >= 1) {
          item.quantity = qty;
        }
      }

      if (
        updates &&
        Object.prototype.hasOwnProperty.call(updates, "customizations")
      ) {
        item.customizations = Array.isArray(updates.customizations)
          ? updates.customizations
          : [];
      }

      if (updates && Object.prototype.hasOwnProperty.call(updates, "comment")) {
        const normalizedComment =
          updates.comment === null || updates.comment === undefined
            ? null
            : String(updates.comment).trim() || null;
        item.comment = normalizedComment;
      }

      // NEW: allow storing resolved add-on objects for correct pricing in cart
      if (updates && Object.prototype.hasOwnProperty.call(updates, "addons")) {
        item.addons = Array.isArray(updates.addons) ? updates.addons : [];
      }

      next[idx] = item;

      await this.setCart(b, next);
      return next;
    } catch (error) {
      console.error("[LOCAL CART] Error updating item details:", error);
      throw error;
    }
  },

  /**
   * Remove item from cart
   */
  async removeItem(branchId, itemId) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const current = await this.getCart(b);
      const next = Array.isArray(current)
        ? current.filter((it) => Number(it.id) !== Number(itemId))
        : [];

      await this.setCart(b, next);
      return next;
    } catch (error) {
      console.error("[LOCAL CART] Error removing item:", error);
      throw error;
    }
  },

  /**
   * Clear cart for a specific branch
   */
  async clearCart(branchId) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      await this.setCart(b, []);
      return [];
    } catch (error) {
      console.error("[LOCAL CART] Error clearing cart:", error);
      throw error;
    }
  },

  /**
   * Clear all carts (used after migration to server)
   */
  async clearAllCarts() {
    try {
      await ensureMigratedToSecureStore();
      const index = await getSecureIndex();

      for (const b of index) {
        await SecureStore.deleteItemAsync(`${SECURE_BRANCH_KEY_PREFIX}${b}`);
      }

      await SecureStore.deleteItemAsync(SECURE_INDEX_KEY);

      // Also clear legacy key (safety)
      await AsyncStorage.removeItem(LEGACY_ASYNC_KEY);
    } catch (error) {
      console.error("[LOCAL CART] Error clearing all carts:", error);
      throw error;
    }
  },

  /**
   * Get all carts (for migration after sign-in)
   */
  async getAllCarts() {
    try {
      await ensureMigratedToSecureStore();
      const index = await getSecureIndex();
      const all = {};

      for (const b of index) {
        const raw = await SecureStore.getItemAsync(
          `${SECURE_BRANCH_KEY_PREFIX}${b}`,
        );
        const items = safeParseJson(raw, []);
        all[b] = Array.isArray(items) ? items : [];
      }

      return all;
    } catch (error) {
      console.error("[LOCAL CART] Error getting all carts:", error);
      return {};
    }
  },
};
