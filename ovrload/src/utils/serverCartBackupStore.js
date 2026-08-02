import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// IMPORTANT: This store is ONLY used as a safety net for signed-in users.
// It prevents the UI from looking like it "wiped" the cart when the server
// temporarily fails to resolve the user (common in phone OTP flows).
//
// NOTE: We store cart data in SecureStore (encrypted on-device) for better
// App Store compliance (Guideline 5.1.1(vi)).

const LEGACY_ASYNC_KEY = "server_cart_backup";
const SECURE_INDEX_KEY = "server_cart_backup_v2_index";
const SECURE_MIGRATED_FLAG_KEY = "server_cart_backup_v2_migrated";
const SECURE_BRANCH_KEY_PREFIX = "server_cart_backup_v2_branch_";

// IMPORTANT:
// Using Date.now() alone can generate duplicate ids if two items are written in
// the same millisecond. That can cause list-key collisions and weird UI.
let backupIdCounter = 0;
const generateBackupCartItemId = () => {
  backupIdCounter = (backupIdCounter + 1) % 1000;
  return Date.now() * 1000 + backupIdCounter;
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

// NEW: stable normalization so backup cart doesn't accidentally merge different option sets.
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
    const legacyAll = safeParseJson(legacyRaw, null);

    if (legacyAll && typeof legacyAll === "object") {
      const index = [];

      for (const [branchId, items] of Object.entries(legacyAll)) {
        const b = normalizeBranchId(branchId);
        if (!b) {
          continue;
        }

        const safeItems = Array.isArray(items) ? items : [];
        if (safeItems.length === 0) {
          continue;
        }

        await SecureStore.setItemAsync(
          `${SECURE_BRANCH_KEY_PREFIX}${b}`,
          JSON.stringify(safeItems),
        );
        index.push(b);
      }

      await setSecureIndex(index);
      await AsyncStorage.removeItem(LEGACY_ASYNC_KEY);
    }

    await SecureStore.setItemAsync(SECURE_MIGRATED_FLAG_KEY, "1");
  } catch (error) {
    console.error("[SERVER CART BACKUP] SecureStore migration failed:", error);
  }
}

export const serverCartBackupStore = {
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
      console.error("[SERVER CART BACKUP] Error getting cart:", error);
      return [];
    }
  },

  async setCart(branchId, items) {
    try {
      await ensureMigratedToSecureStore();
      const b = normalizeBranchId(branchId);
      if (!b) {
        return [];
      }

      const key = `${SECURE_BRANCH_KEY_PREFIX}${b}`;
      const safeItems = Array.isArray(items) ? items : [];
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
      console.error("[SERVER CART BACKUP] Error setting cart:", error);
      throw error;
    }
  },

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
        const existing = next[existingIndex];
        const nextQty = (existing.quantity || 0) + (item.quantity || 0);
        next[existingIndex] = {
          ...existing,
          ...item,
          comment: normalizedComment,
          quantity: nextQty,
        };
      } else {
        next.push({
          id: generateBackupCartItemId(),
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
      console.error("[SERVER CART BACKUP] Error adding item:", error);
      throw error;
    }
  },

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
      console.error("[SERVER CART BACKUP] Error clearing cart:", error);
      throw error;
    }
  },

  async clearAllCarts() {
    try {
      await ensureMigratedToSecureStore();
      const index = await getSecureIndex();

      for (const b of index) {
        await SecureStore.deleteItemAsync(`${SECURE_BRANCH_KEY_PREFIX}${b}`);
      }

      await SecureStore.deleteItemAsync(SECURE_INDEX_KEY);
      await AsyncStorage.removeItem(LEGACY_ASYNC_KEY);
    } catch (error) {
      console.error("[SERVER CART BACKUP] Error clearing all carts:", error);
      throw error;
    }
  },

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
      console.error("[SERVER CART BACKUP] Error getting all carts:", error);
      return {};
    }
  },
};
