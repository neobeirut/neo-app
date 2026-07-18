import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { X, Plus, Minus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/utils/theme";

export default function ProductCustomizationModal({
  visible,
  onClose,
  product,
  onAddToCart,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [customizations, setCustomizations] = useState([]);
  const [selectedCustomizations, setSelectedCustomizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (visible && product) {
      fetchCustomizations();
    }
  }, [visible, product]);

  const fetchCustomizations = async () => {
    if (!product) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/products/${product.id}/customizations`,
      );
      if (response.ok) {
        const data = await response.json();
        setCustomizations(data.customizations || []);
      }
    } catch (error) {
      console.error("Error fetching customizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomization = (customization) => {
    setSelectedCustomizations((prev) => {
      const exists = prev.find((c) => c.id === customization.id);
      if (exists) {
        return prev.filter((c) => c.id !== customization.id);
      } else {
        return [...prev, customization];
      }
    });
  };

  const isSelected = (customizationId) => {
    return selectedCustomizations.some((c) => c.id === customizationId);
  };

  const calculateTotal = () => {
    const basePrice = parseFloat(product.price || 0);
    const customizationsTotal = selectedCustomizations
      .filter((c) => c.customization_type === "addon")
      .reduce((sum, c) => sum + parseFloat(c.price || 0), 0);
    return (basePrice + customizationsTotal) * quantity;
  };

  const handleAddToCart = () => {
    if (!product) return;
    onAddToCart(quantity, selectedCustomizations);
    handleClose();
  };

  const handleClose = () => {
    setSelectedCustomizations([]);
    setQuantity(1);
    onClose();
  };

  // Early return if no product
  if (!product) {
    return null;
  }

  const addons = customizations.filter((c) => c.customization_type === "addon");
  const removals = customizations.filter(
    (c) => c.customization_type === "remove",
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
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
            maxHeight: "90%",
            paddingTop: 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.separator,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
              }}
            >
              Customize {product?.name}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View
              style={{
                padding: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 20,
                paddingBottom: insets.bottom + 100,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Add-ons Section */}
              {addons.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: 12,
                    }}
                  >
                    Add-ons
                  </Text>
                  {addons.map((addon) => (
                    <TouchableOpacity
                      key={addon.id}
                      onPress={() => toggleCustomization(addon)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: isSelected(addon.id)
                          ? colors.primary + "15"
                          : colors.surface,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: isSelected(addon.id)
                          ? colors.primary
                          : colors.separator,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 14,
                            color: colors.text,
                          }}
                        >
                          {addon.ingredient}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: colors.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          +${parseFloat(addon.price || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected(addon.id)
                            ? colors.primary
                            : colors.separator,
                          backgroundColor: isSelected(addon.id)
                            ? colors.primary
                            : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected(addon.id) && (
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: "#FFFFFF",
                            }}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Removals Section */}
              {removals.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: 12,
                    }}
                  >
                    Remove Items
                  </Text>
                  {removals.map((removal) => (
                    <TouchableOpacity
                      key={removal.id}
                      onPress={() => toggleCustomization(removal)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: isSelected(removal.id)
                          ? colors.primary + "15"
                          : colors.surface,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: isSelected(removal.id)
                          ? colors.primary
                          : colors.separator,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 14,
                            color: colors.text,
                          }}
                        >
                          No {removal.ingredient}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected(removal.id)
                            ? colors.primary
                            : colors.separator,
                          backgroundColor: isSelected(removal.id)
                            ? colors.primary
                            : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected(removal.id) && (
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: "#FFFFFF",
                            }}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {customizations.length === 0 && (
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                    textAlign: "center",
                    paddingVertical: 40,
                  }}
                >
                  No customizations available for this product
                </Text>
              )}
            </ScrollView>
          )}

          {/* Bottom Bar */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: colors.background,
            }}
          >
            {/* Quantity Selector */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Minus size={20} color={colors.text} />
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 18,
                  color: colors.text,
                  marginHorizontal: 24,
                  minWidth: 30,
                  textAlign: "center",
                }}
              >
                {quantity}
              </Text>
              <TouchableOpacity
                onPress={() => setQuantity(quantity + 1)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Add to Cart Button */}
            <TouchableOpacity
              onPress={handleAddToCart}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: "#FFFFFF",
                }}
              >
                Add to Cart - ${calculateTotal().toFixed(2)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
