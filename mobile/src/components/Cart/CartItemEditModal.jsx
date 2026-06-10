import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/utils/theme";
import { apiFetch } from "@/utils/apiFetch";

function safeNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function getCustomizationType(c) {
  return c?.customization_type || c?.type || null;
}

function normalizeCartComment(comment) {
  if (comment === null || comment === undefined) return "";
  return String(comment).trim();
}

export default function CartItemEditModal({
  visible,
  onClose,
  item,
  onSave, // async ({ cart_item_id, customizations, comment, selected_addons }) => Promise
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [allCustomizations, setAllCustomizations] = useState([]);
  const [productAddons, setProductAddons] = useState([]);

  // Selections
  const [selectedAddonAndRemovalIds, setSelectedAddonAndRemovalIds] = useState(
    [],
  );
  const [selectedOptionsByGroup, setSelectedOptionsByGroup] = useState({});

  // NEW: product add-ons selection (product_addons table)
  const [selectedProductAddonIds, setSelectedProductAddonIds] = useState([]);

  const [comment, setComment] = useState("");

  const productId = item?.product_id;

  // Fetch customizations + add-ons list for the product
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!visible || !productId) {
        return;
      }

      setError(null);
      setLoading(true);

      try {
        // Create abort controllers for both requests
        const customizationsController = new AbortController();
        const addonsController = new AbortController();

        const customizationsTimeout = setTimeout(
          () => customizationsController.abort(),
          10000,
        ); // 10 second timeout
        const addonsTimeout = setTimeout(() => addonsController.abort(), 10000); // 10 second timeout

        const [customizationsRes, addonsRes] = await Promise.all([
          apiFetch(`/api/products/${productId}/customizations`, {
            signal: customizationsController.signal,
          }).catch((error) => {
            clearTimeout(customizationsTimeout);
            if (error.name === "AbortError") {
              console.error(
                "[CartItemEditModal] Customizations fetch timed out",
              );
            }
            throw error;
          }),
          apiFetch(`/api/products/${productId}/addons`, {
            signal: addonsController.signal,
          }).catch((error) => {
            clearTimeout(addonsTimeout);
            if (error.name === "AbortError") {
              console.error("[CartItemEditModal] Addons fetch timed out");
            }
            throw error;
          }),
        ]);

        clearTimeout(customizationsTimeout);
        clearTimeout(addonsTimeout);

        if (!customizationsRes.ok) {
          const txt = await customizationsRes.text().catch(() => "");
          throw new Error(
            `Could not load customizations (status ${customizationsRes.status}) ${txt}`,
          );
        }

        const customizationsData = await customizationsRes
          .json()
          .catch(() => null);
        const customizationsRows = Array.isArray(
          customizationsData?.customizations,
        )
          ? customizationsData.customizations
          : [];

        let addonsRows = [];
        if (addonsRes.ok) {
          const addonsData = await addonsRes.json().catch(() => null);
          addonsRows = Array.isArray(addonsData?.addons)
            ? addonsData.addons
            : [];
        }

        if (!cancelled) {
          setAllCustomizations(customizationsRows);
          setProductAddons(addonsRows);
        }
      } catch (e) {
        console.error("[CartItemEditModal] Failed to load options/add-ons", e);
        if (!cancelled) {
          const errorMessage =
            e.name === "AbortError"
              ? "Request timed out. Please check your connection and try again."
              : String(e?.message || e);
          setError(errorMessage);
          setAllCustomizations([]);
          setProductAddons([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [visible, productId]);

  // Initialize selections from the cart item
  useEffect(() => {
    if (!visible || !item) {
      return;
    }

    const current = Array.isArray(item.customizations)
      ? item.customizations
      : [];

    const optionEntries = current.filter(
      (c) => getCustomizationType(c) === "option",
    );
    const otherEntries = current.filter((c) => {
      const t = getCustomizationType(c);
      return t === "addon" || t === "remove";
    });

    const nextSelected = otherEntries.map((c) => c.id).filter(Boolean);

    const nextOptions = {};
    optionEntries.forEach((opt) => {
      const group = opt?.option_group_name || "Options";
      const id = opt?.id;
      if (!id) return;
      if (!Array.isArray(nextOptions[group])) nextOptions[group] = [];
      nextOptions[group].push(id);
    });

    // NEW: initialize product add-ons from item.addons
    const existingAddons = Array.isArray(item.addons) ? item.addons : [];
    const nextProductAddonIds = existingAddons
      .map((a) => a?.addon_id ?? a?.id)
      .filter(Boolean)
      .map((x) => Number(x));

    setSelectedAddonAndRemovalIds(nextSelected);
    setSelectedOptionsByGroup(nextOptions);
    setSelectedProductAddonIds(nextProductAddonIds);
    setComment(normalizeCartComment(item.comment));
  }, [visible, item?.id]);

  const options = useMemo(() => {
    return allCustomizations.filter((c) => c.customization_type === "option");
  }, [allCustomizations]);

  const removals = useMemo(() => {
    return allCustomizations.filter((c) => c.customization_type === "remove");
  }, [allCustomizations]);

  const optionGroups = useMemo(() => {
    const groups = {};
    options.forEach((opt) => {
      const group = opt.option_group_name || "Options";
      if (!groups[group]) groups[group] = [];
      groups[group].push(opt);
    });

    return Object.entries(groups).map(([groupName, groupOptions]) => {
      const isMultiSelect = !!groupOptions?.[0]?.is_multi_select;
      const isRequired = !!groupOptions?.some((o) => !!o.is_required);
      return { groupName, options: groupOptions, isMultiSelect, isRequired };
    });
  }, [options]);

  const toggleProductAddon = (addonId) => {
    const id = Number(addonId);
    if (!Number.isFinite(id)) return;

    setSelectedProductAddonIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const toggleAddonOrRemoval = (id) => {
    setSelectedAddonAndRemovalIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const toggleOption = (groupName, optionId, isMultiSelect) => {
    setSelectedOptionsByGroup((prev) => {
      const current = Array.isArray(prev[groupName]) ? prev[groupName] : [];

      if (isMultiSelect) {
        if (current.includes(optionId)) {
          return {
            ...prev,
            [groupName]: current.filter((x) => x !== optionId),
          };
        }
        return { ...prev, [groupName]: [...current, optionId] };
      }

      if (current.includes(optionId)) {
        return { ...prev, [groupName]: [] };
      }

      return { ...prev, [groupName]: [optionId] };
    });
  };

  const buildPayloadCustomizations = () => {
    const byId = new Map(allCustomizations.map((c) => [c.id, c]));

    const addonRemove = selectedAddonAndRemovalIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((c) => {
        return {
          id: c.id,
          type: c.customization_type,
          ingredient: c.ingredient,
          price: safeNumber(c.price),
        };
      });

    const optionIds = Object.values(selectedOptionsByGroup)
      .flat()
      .filter(Boolean);

    const optionObjs = optionIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((c) => {
        return {
          id: c.id,
          type: "option",
          ingredient: c.ingredient,
          price: safeNumber(c.price),
          option_group_name: c.option_group_name || "Options",
        };
      });

    return [...optionObjs, ...addonRemove];
  };

  const computeUnitExtraTotal = () => {
    const byId = new Map(allCustomizations.map((c) => [c.id, c]));

    let total = 0;

    // options price
    const optionIds = Object.values(selectedOptionsByGroup).flat();
    optionIds.forEach((id) => {
      const c = byId.get(id);
      total += safeNumber(c?.price);
    });

    // removals are free, ignore

    // product add-ons price
    const addonsById = new Map(
      (Array.isArray(productAddons) ? productAddons : []).map((a) => [
        Number(a.id),
        a,
      ]),
    );

    selectedProductAddonIds.forEach((id) => {
      const a = addonsById.get(Number(id));
      total += safeNumber(a?.price);
    });

    return total;
  };

  const onPressSave = async () => {
    if (!item?.id) return;

    // Validate required option groups
    for (const g of optionGroups) {
      if (!g.isRequired) continue;

      const selected = selectedOptionsByGroup[g.groupName] || [];
      if (!selected || selected.length === 0) {
        setError(`Please select an option for \"${g.groupName}\"`);
        return;
      }
    }

    setError(null);
    setSaving(true);

    try {
      const payloadCustomizations = buildPayloadCustomizations();
      const normalized = String(comment || "").trim();
      const normalizedOrNull = normalized.length > 0 ? normalized : null;

      await onSave({
        cart_item_id: item.id,
        selected_addons: selectedProductAddonIds,
        customizations: payloadCustomizations,
        comment: normalizedOrNull,
      });

      onClose();
    } catch (e) {
      console.error("[CartItemEditModal] save failed", e);
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (!item) {
    return null;
  }

  const basePrice = safeNumber(item?.price);
  const extra = computeUnitExtraTotal();
  const previewUnit = basePrice + extra;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "92%",
            paddingTop: 18,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.separator,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 18,
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                Edit item
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {item?.name || "Product"} • Unit ${previewUnit.toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 16,
                paddingBottom: insets.bottom + 120,
              }}
              showsVerticalScrollIndicator={false}
            >
              {error ? (
                <View
                  style={{
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#ef4444",
                    backgroundColor: "#ef444415",
                    borderRadius: 12,
                    marginBottom: 14,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      color: "#ef4444",
                      fontSize: 12,
                    }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Options */}
              {optionGroups.length > 0 ? (
                <View style={{ marginBottom: 22 }}>
                  <Text
                    style={{
                      fontFamily: "PlayfairDisplay_500Medium",
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: 10,
                    }}
                  >
                    Options
                  </Text>

                  {optionGroups.map((g) => {
                    const selected = selectedOptionsByGroup[g.groupName] || [];
                    const reqLabel = g.isRequired ? "Required" : "Optional";
                    const multiLabel = g.isMultiSelect ? "Multi" : "Single";

                    return (
                      <View
                        key={g.groupName}
                        style={{
                          marginBottom: 14,
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.separator,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Inter_600SemiBold",
                              fontSize: 14,
                              color: colors.text,
                            }}
                          >
                            {g.groupName}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Inter_400Regular",
                              fontSize: 11,
                              color: colors.textSecondary,
                            }}
                          >
                            {reqLabel} • {multiLabel}
                          </Text>
                        </View>

                        {g.options.map((opt) => {
                          const isSelected = selected.includes(opt.id);
                          const rowBg = isSelected
                            ? colors.primary + "15"
                            : "transparent";

                          const priceValue = safeNumber(opt.price);
                          const priceLabel =
                            priceValue > 0 ? `+$${priceValue.toFixed(2)}` : "";

                          return (
                            <TouchableOpacity
                              key={opt.id}
                              onPress={() =>
                                toggleOption(
                                  g.groupName,
                                  opt.id,
                                  g.isMultiSelect,
                                )
                              }
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 10,
                                borderRadius: 10,
                                backgroundColor: rowBg,
                                borderWidth: 1,
                                borderColor: isSelected
                                  ? colors.primary
                                  : colors.separator,
                                marginBottom: 8,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: "Inter_500Medium",
                                    fontSize: 13,
                                    color: colors.text,
                                  }}
                                >
                                  {opt.ingredient}
                                </Text>
                                {priceLabel ? (
                                  <Text
                                    style={{
                                      fontFamily: "Inter_400Regular",
                                      fontSize: 12,
                                      color: colors.textSecondary,
                                    }}
                                  >
                                    {priceLabel}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Product Add-ons */}
              {Array.isArray(productAddons) && productAddons.length > 0 ? (
                <View style={{ marginBottom: 22 }}>
                  <Text
                    style={{
                      fontFamily: "PlayfairDisplay_500Medium",
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: 10,
                    }}
                  >
                    Add-ons
                  </Text>

                  {productAddons.map((a) => {
                    const id = Number(a.id);
                    const isSelected = selectedProductAddonIds.includes(id);
                    const rowBg = isSelected
                      ? colors.primary + "15"
                      : colors.surface;

                    const priceValue = safeNumber(a.price);

                    return (
                      <TouchableOpacity
                        key={String(a.id)}
                        onPress={() => toggleProductAddon(a.id)}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.separator,
                          backgroundColor: rowBg,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 13,
                            color: colors.text,
                          }}
                        >
                          + {a.name}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: colors.textSecondary,
                          }}
                        >
                          +${priceValue.toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* Removals */}
              {removals.length > 0 ? (
                <View style={{ marginBottom: 22 }}>
                  <Text
                    style={{
                      fontFamily: "PlayfairDisplay_500Medium",
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: 10,
                    }}
                  >
                    Remove items
                  </Text>

                  {removals.map((r) => {
                    const isSelected = selectedAddonAndRemovalIds.includes(
                      r.id,
                    );
                    const rowBg = isSelected
                      ? colors.primary + "15"
                      : colors.surface;

                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => toggleAddonOrRemoval(r.id)}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.separator,
                          backgroundColor: rowBg,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 13,
                            color: colors.text,
                          }}
                        >
                          No {r.ingredient}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: colors.textSecondary,
                          }}
                        >
                          {isSelected ? "Selected" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* Item note */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontFamily: "PlayfairDisplay_500Medium",
                    fontSize: 16,
                    color: colors.text,
                    marginBottom: 10,
                  }}
                >
                  Item note
                </Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a note for this item (optional)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={200}
                  style={{
                    minHeight: Platform.OS === "web" ? 70 : 90,
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.separator,
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.text,
                    textAlignVertical: "top",
                  }}
                />
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 6,
                  }}
                >
                  {comment.length}/200
                </Text>
              </View>

              {allCustomizations.length === 0 &&
              (!Array.isArray(productAddons) || productAddons.length === 0) ? (
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    color: colors.textSecondary,
                    textAlign: "center",
                    paddingVertical: 30,
                  }}
                >
                  No customizations available for this item.
                </Text>
              ) : null}
            </ScrollView>
          )}

          {/* Bottom bar */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: insets.bottom + 14,
              backgroundColor: colors.background,
            }}
          >
            <TouchableOpacity
              onPress={onPressSave}
              disabled={saving || loading}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                opacity: saving || loading ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 16,
                    color: "white",
                  }}
                >
                  Save changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
