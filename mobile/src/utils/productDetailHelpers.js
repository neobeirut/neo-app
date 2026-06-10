import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

export const getStatusColor = (status, colors) => {
  switch (status) {
    case "Available":
      return colors.success || "#22c55e";
    case "Unavailable Today":
      return "#f59e0b";
    case "Unavailable Until Further Notice":
      return "#ef4444";
    default:
      return colors.textSecondary;
  }
};

/**
 * Build default selections for option groups.
 * Prefer the admin-defined default (is_default). If none, pick the first option
 * (sorted by display_order, then ingredient).
 */
export const getDefaultSelectedOptions = (customizations = []) => {
  const options = (Array.isArray(customizations) ? customizations : []).filter(
    (c) => c?.customization_type === "option",
  );

  const groups = {};
  options.forEach((opt) => {
    const groupName = opt?.option_group_name || "Options";
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(opt);
  });

  const selected = {};

  Object.entries(groups).forEach(([groupName, opts]) => {
    const list = Array.isArray(opts) ? opts : [];

    // 1) Prefer per-product default
    const productDefault = list.find((o) => o?.is_default_for_product === true);
    const productDefaultId = productDefault?.id
      ? Number(productDefault.id)
      : null;
    if (Number.isFinite(productDefaultId)) {
      selected[groupName] = [productDefaultId];
      return;
    }

    // 2) Prefer global group default (is_default)
    const explicitDefault = list.find((o) => o?.is_default === true);
    const explicitId = explicitDefault?.id ? Number(explicitDefault.id) : null;
    if (Number.isFinite(explicitId)) {
      selected[groupName] = [explicitId];
      return;
    }

    // 3) Fall back to first by display_order, then ingredient
    const sorted = list.slice().sort((a, b) => {
      const da = Number(a?.display_order ?? 999999);
      const db = Number(b?.display_order ?? 999999);
      if (da !== db) return da - db;
      return String(a?.ingredient || "").localeCompare(
        String(b?.ingredient || ""),
      );
    });

    const first = sorted[0];
    const firstId = first?.id ? Number(first.id) : null;
    if (Number.isFinite(firstId)) {
      selected[groupName] = [firstId];
    }
  });

  return selected;
};

/**
 * Convert current selections into the payload we store in cart_items.customizations.
 */
export const buildCustomizationsPayload = ({
  customizations = [],
  selectedCustomizations = [],
  selectedOptions = {},
}) => {
  const safeCustomizations = Array.isArray(customizations)
    ? customizations
    : [];

  const formattedCustomizations = (
    Array.isArray(selectedCustomizations) ? selectedCustomizations : []
  )
    .map((id) => {
      const customization = safeCustomizations.find((c) => c.id === id);
      if (!customization) return null;
      return {
        id: customization.id,
        type: customization.customization_type,
        ingredient: customization.ingredient,
        price: parseFloat(customization.price || 0),
      };
    })
    .filter(Boolean);

  const selectedOptionIds = Object.values(
    selectedOptions && typeof selectedOptions === "object"
      ? selectedOptions
      : {},
  ).flat();

  const formattedOptions = (
    Array.isArray(selectedOptionIds) ? selectedOptionIds : []
  )
    .map((id) => {
      const option = safeCustomizations.find((c) => c.id === id);
      if (!option) return null;
      return {
        id: option.id,
        type: "option",
        ingredient: option.ingredient,
        price: parseFloat(option.price || 0),
        option_group_name: option.option_group_name,
      };
    })
    .filter(Boolean);

  // IMPORTANT:
  // Normalize order so the same selections always produce the same JSON.
  // This prevents cart line “uniqueness” bugs where the same choices
  // are treated as different (or vice-versa) just due to array order.
  const combined = [...formattedCustomizations, ...formattedOptions];
  const normalized = combined
    .map((c) => ({
      ...c,
      id: Number(c?.id),
      type: String(c?.type || ""),
      ingredient: c?.ingredient === undefined ? null : String(c.ingredient),
      option_group_name:
        c?.option_group_name === undefined || c?.option_group_name === null
          ? null
          : String(c.option_group_name),
      price: Number(c?.price || 0),
    }))
    .filter((c) => Number.isFinite(c.id) && c.type)
    .sort((a, b) => {
      // group by type, then option group, then id
      const t = a.type.localeCompare(b.type);
      if (t !== 0) return t;
      const g = String(a.option_group_name || "").localeCompare(
        String(b.option_group_name || ""),
      );
      if (g !== 0) return g;
      return a.id - b.id;
    });

  return normalized;
};

export const calculateTotalPrice = (
  product,
  addons,
  selectedAddons,
  customizations = [],
  selectedCustomizations = [],
  selectedOptions = {},
) => {
  const basePrice = Number(product?.price || 0);
  const addonsTotal = selectedAddons.reduce((sum, addonId) => {
    const addon = addons.find((a) => a.id === addonId);
    return sum + Number(addon?.price || 0);
  }, 0);
  const customizationsTotal = selectedCustomizations.reduce(
    (sum, customizationId) => {
      const customization = customizations.find(
        (c) => c.id === customizationId,
      );
      if (customization?.customization_type === "addon") {
        return sum + Number(customization?.price || 0);
      }
      return sum;
    },
    0,
  );

  const optionsTotal = Object.values(selectedOptions)
    .flat()
    .reduce((sum, optionId) => {
      const option = customizations.find((c) => c.id === optionId);
      return sum + Number(option?.price || 0);
    }, 0);

  return basePrice + addonsTotal + customizationsTotal + optionsTotal;
};

export const handleAddToCart = async ({
  product,
  selectedBranch,
  productId,
  quantity = 1,
  selectedAddons,
  selectedCustomizations = [],
  selectedOptions = {},
  customizations = [],
  addToCartMutation,
  comment,
  onWillAdd,
}) => {
  // Fire-and-forget haptics so navigation/animation isn't delayed.
  Haptics.selectionAsync().catch(() => {});

  // NOTE: We DO NOT require sign-in here.
  // Guest users can add to cart; sign-in is enforced at checkout.

  // Check if product is completely unavailable
  if (
    product.status === "Unavailable Until Further Notice" ||
    product.status === "Hide from Menu"
  ) {
    const statusText =
      product.status === "Unavailable Until Further Notice"
        ? "on hold"
        : product.status.toLowerCase();
    Alert.alert(
      "Product Unavailable",
      `${product.name} is currently ${statusText}.`,
    );
    return;
  }

  // Validate required options
  const options = customizations.filter(
    (c) => c.customization_type === "option",
  );
  const requiredGroups = {};

  options.forEach((option) => {
    const groupName = option.option_group_name || "Options";
    if (option.is_required) {
      requiredGroups[groupName] = true;
    }
  });

  for (const groupName in requiredGroups) {
    if (
      !selectedOptions[groupName] ||
      selectedOptions[groupName].length === 0
    ) {
      Alert.alert(
        "Required Selection",
        `Please select an option for "${groupName}"`,
      );
      return;
    }
  }

  const allCustomizations = buildCustomizationsPayload({
    customizations,
    selectedCustomizations,
    selectedOptions,
  });

  const normalizedComment =
    comment === null || comment === undefined
      ? null
      : String(comment).trim() || null;

  // Product add-ons (product_addons table)
  // IMPORTANT: normalize to stable, unique, sorted IDs so cart uniqueness behaves consistently
  const selectedAddonIds = Array.isArray(selectedAddons)
    ? Array.from(
        new Set(
          selectedAddons
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x)),
        ),
      ).sort((a, b) => a - b)
    : [];

  // IMPORTANT UX FIX:
  // Navigate back after adding to show users the updated cart.
  if (product.status === "Unavailable Today") {
    Alert.alert(
      "Unavailable Today",
      `${product.name} is unavailable for orders today. If you schedule delivery/pickup for today, you will not receive this item.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
        },
        {
          text: "Add Anyway",
          onPress: () => {
            if (typeof onWillAdd === "function") {
              onWillAdd();
            }
            addToCartMutation.mutate({
              product_id: Number(productId),
              branch_id: selectedBranch.id,
              quantity,
              selected_addons: selectedAddonIds,
              customizations: allCustomizations,
              comment: normalizedComment,
              shouldNavigateBack: false, // ✅ Navigation handled in product-detail screen
            });
          },
        },
      ],
    );
    return;
  }

  if (typeof onWillAdd === "function") {
    onWillAdd();
  }
  addToCartMutation.mutate({
    product_id: Number(productId),
    branch_id: selectedBranch.id,
    quantity,
    selected_addons: selectedAddonIds,
    customizations: allCustomizations,
    comment: normalizedComment,
    shouldNavigateBack: false, // ✅ Navigation handled in product-detail screen
  });
};
