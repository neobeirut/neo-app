import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Package,
  Truck,
  ShoppingBag,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function OrderDetailModal({ order, visible, onClose, colors }) {
  if (!order) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "confirmed":
      case "preparing":
        return "#3B82F6";
      case "ready":
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return colors.textSecondary;
    }
  };

  const handleClose = async () => {
    await Haptics.selectionAsync();
    onClose();
  };

  const items = order.items || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
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
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: SCREEN_HEIGHT * 0.85,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.separator,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: "PlayfairDisplay_500Medium",
                  fontSize: 24,
                  color: colors.text,
                }}
              >
                Order #{order.id}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: getStatusColor(order.status) + "20",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                      color: getStatusColor(order.status),
                      textTransform: "capitalize",
                    }}
                  >
                    {order.status}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Order Type & Branch */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary + "20",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {order.order_type === "delivery" ? (
                  <Truck size={24} color={colors.primary} />
                ) : (
                  <ShoppingBag size={24} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 16,
                    color: colors.text,
                    textTransform: "capitalize",
                  }}
                >
                  {order.order_type}
                </Text>
                {order.branch_name && (
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {order.branch_name}
                  </Text>
                )}
              </View>
            </View>

            {/* Schedule */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Schedule
              </Text>
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Calendar size={18} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: colors.textSecondary,
                    }}
                  >
                    {order.scheduled_date}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Clock size={18} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: colors.textSecondary,
                    }}
                  >
                    {order.scheduled_time}
                  </Text>
                </View>
              </View>
            </View>

            {/* Delivery Address */}
            {order.delivery_address && (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: colors.text,
                    marginBottom: 8,
                  }}
                >
                  Delivery Address
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                  }}
                >
                  <MapPin size={18} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 14,
                        color: colors.textSecondary,
                      }}
                    >
                      {order.delivery_address}
                    </Text>
                    {order.building && (
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 14,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {order.building}
                      </Text>
                    )}
                    {order.company_name && (
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 14,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {order.company_name}
                      </Text>
                    )}
                    {order.address_line2 && (
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 14,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {order.address_line2}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Special Instructions */}
            {order.special_instructions && (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: colors.text,
                    marginBottom: 8,
                  }}
                >
                  Special Instructions
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                    fontStyle: "italic",
                  }}
                >
                  {order.special_instructions}
                </Text>
              </View>
            )}

            {/* Order Items */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Package size={18} color={colors.text} />
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  Items ({items.length})
                </Text>
              </View>

              {items.map((item, index) => {
                const itemCustomizations = Array.isArray(item.customizations)
                  ? item.customizations
                  : [];

                const options = itemCustomizations.filter(
                  (c) => c.customization_type === "option",
                );
                const addons = itemCustomizations.filter(
                  (c) => c.customization_type === "addon",
                );
                const removals = itemCustomizations.filter(
                  (c) => c.customization_type === "remove",
                );

                return (
                  <View
                    key={index}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: index < items.length - 1 ? 1 : 0,
                      borderBottomColor: colors.separator,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 14,
                          color: colors.text,
                          flex: 1,
                        }}
                      >
                        {item.quantity}x {item.product_name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 14,
                          color: colors.text,
                        }}
                      >
                        ${parseFloat(item.total_price).toFixed(2)}
                      </Text>
                    </View>

                    {/* Per-item note */}
                    {item?.comment && String(item.comment).trim() ? (
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          color: colors.textSecondary,
                          marginTop: 4,
                          fontStyle: "italic",
                        }}
                      >
                        Note: {String(item.comment)}
                      </Text>
                    ) : null}

                    {/* Customizations */}
                    {itemCustomizations.length > 0 && (
                      <View style={{ paddingLeft: 12, marginTop: 6 }}>
                        {/* Options */}
                        {options.map((customization, customIndex) => {
                          const priceNumber = Number.parseFloat(
                            customization?.price || 0,
                          );
                          const hasPrice =
                            Number.isFinite(priceNumber) && priceNumber > 0;
                          const priceLabel = hasPrice
                            ? ` (+$${priceNumber.toFixed(2)})`
                            : "";

                          return (
                            <Text
                              key={`option-${customIndex}`}
                              style={{
                                fontFamily: "Inter_500Medium",
                                fontSize: 12,
                                color: colors.primary,
                              }}
                            >
                              {customization.option_group_name
                                ? `${customization.option_group_name}: `
                                : ""}
                              {customization.ingredient}
                              {priceLabel}
                            </Text>
                          );
                        })}

                        {/* Add-ons */}
                        {addons.length > 0 && (
                          <View style={{ marginTop: 6 }}>
                            <Text
                              style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 12,
                                color: colors.text,
                                marginBottom: 2,
                              }}
                            >
                              Add-ons:
                            </Text>
                            {addons.map((customization, customIndex) => {
                              const priceNumber = Number.parseFloat(
                                customization?.price || 0,
                              );
                              const hasPrice =
                                Number.isFinite(priceNumber) && priceNumber > 0;
                              const priceLabel = hasPrice
                                ? ` (+$${priceNumber.toFixed(2)})`
                                : "";

                              return (
                                <Text
                                  key={`addon-${customIndex}`}
                                  style={{
                                    fontFamily: "Inter_400Regular",
                                    fontSize: 12,
                                    color: colors.textSecondary,
                                  }}
                                >
                                  + {customization.ingredient}
                                  {priceLabel}
                                </Text>
                              );
                            })}
                          </View>
                        )}

                        {/* Removals */}
                        {removals.length > 0 && (
                          <View style={{ marginTop: 6 }}>
                            <Text
                              style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 12,
                                color: colors.text,
                                marginBottom: 2,
                              }}
                            >
                              Removals:
                            </Text>
                            {removals.map((customization, customIndex) => (
                              <Text
                                key={`remove-${customIndex}`}
                                style={{
                                  fontFamily: "Inter_400Regular",
                                  fontSize: 12,
                                  color: colors.textSecondary,
                                }}
                              >
                                - No {customization.ingredient}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Legacy existing addons */}
                    {item.addons && item.addons.length > 0 && (
                      <View style={{ paddingLeft: 12, marginTop: 6 }}>
                        {item.addons.map((addon, addonIndex) => (
                          <Text
                            key={addonIndex}
                            style={{
                              fontFamily: "Inter_400Regular",
                              fontSize: 12,
                              color: colors.textSecondary,
                            }}
                          >
                            + {addon.name} (+$
                            {parseFloat(addon.price).toFixed(2)})
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Total */}
            <View
              style={{
                backgroundColor: colors.primary + "10",
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
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
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 18,
                    color: colors.text,
                  }}
                >
                  Total
                </Text>
                <Text
                  style={{
                    fontFamily: "PlayfairDisplay_800ExtraBold",
                    fontSize: 28,
                    color: colors.primary,
                  }}
                >
                  ${parseFloat(order.total_amount).toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
