import React from "react";
import { View, Text } from "react-native";

export function OrderItemsList({ items, colors }) {
  if (!items || items.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          color: colors.text,
          marginBottom: 8,
        }}
      >
        Items ({items.length})
      </Text>
      {items.map((item, index) => {
        const itemCustomizations = Array.isArray(item?.customizations)
          ? item.customizations
          : [];

        const options = itemCustomizations.filter(
          (c) => c?.customization_type === "option",
        );
        const addons = itemCustomizations.filter(
          (c) => c?.customization_type === "addon",
        );
        const removals = itemCustomizations.filter(
          (c) => c?.customization_type === "remove",
        );

        const hasOptions = options.length > 0;
        const hasAddons = addons.length > 0;
        const hasRemovals = removals.length > 0;

        return (
          <View
            key={index}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
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
                  {item.product_name}
                </Text>

                {/* Customizations (grouped) */}
                {(hasOptions || hasAddons || hasRemovals) && (
                  <View style={{ marginTop: 6 }}>
                    {hasOptions && (
                      <View style={{ marginBottom: 6 }}>
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 12,
                            color: colors.text,
                            marginBottom: 2,
                          }}
                        >
                          Selected Options
                        </Text>
                        {options.map((custom, customIndex) => {
                          const groupLabel = custom?.option_group_name
                            ? `${custom.option_group_name}: `
                            : "";

                          const priceNumber = Number.parseFloat(
                            custom?.price || 0,
                          );
                          const hasPrice =
                            Number.isFinite(priceNumber) && priceNumber > 0;

                          const priceLabel = hasPrice
                            ? ` (+$${priceNumber.toFixed(2)})`
                            : "";

                          return (
                            <Text
                              key={`opt-${customIndex}`}
                              style={{
                                fontFamily: "Inter_400Regular",
                                fontSize: 12,
                                color: colors.textSecondary,
                              }}
                            >
                              {groupLabel}
                              {custom?.ingredient}
                              {priceLabel}
                            </Text>
                          );
                        })}
                      </View>
                    )}

                    {hasAddons && (
                      <View style={{ marginBottom: 6 }}>
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 12,
                            color: colors.text,
                            marginBottom: 2,
                          }}
                        >
                          Add-ons
                        </Text>
                        {addons.map((custom, customIndex) => {
                          const priceNumber = Number.parseFloat(
                            custom?.price || 0,
                          );
                          const hasPrice =
                            Number.isFinite(priceNumber) && priceNumber > 0;

                          const priceLabel = hasPrice
                            ? ` (+$${priceNumber.toFixed(2)})`
                            : "";

                          return (
                            <Text
                              key={`add-${customIndex}`}
                              style={{
                                fontFamily: "Inter_400Regular",
                                fontSize: 12,
                                color: colors.textSecondary,
                              }}
                            >
                              + {custom?.ingredient}
                              {priceLabel}
                            </Text>
                          );
                        })}
                      </View>
                    )}

                    {hasRemovals && (
                      <View>
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 12,
                            color: colors.text,
                            marginBottom: 2,
                          }}
                        >
                          Removals
                        </Text>
                        {removals.map((custom, customIndex) => (
                          <Text
                            key={`rem-${customIndex}`}
                            style={{
                              fontFamily: "Inter_400Regular",
                              fontSize: 12,
                              color: colors.textSecondary,
                            }}
                          >
                            - No {custom?.ingredient}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Display per-item note */}
                {item?.comment && (
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 6,
                      fontStyle: "italic",
                    }}
                  >
                    Note: {String(item.comment)}
                  </Text>
                )}

                {/* Legacy add-ons */}
                {item.addons && item.addons.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                        color: colors.text,
                        marginBottom: 2,
                      }}
                    >
                      Add-ons
                    </Text>
                    {item.addons.map((addon, addonIndex) => (
                      <Text
                        key={addonIndex}
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          color: colors.textSecondary,
                        }}
                      >
                        • {addon.name} (+$
                        {Number.parseFloat(addon.price).toFixed(2)})
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ marginLeft: 12 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: colors.text,
                    textAlign: "right",
                  }}
                >
                  ×{item.quantity}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                ${parseFloat(item.unit_price).toFixed(2)} each
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
          </View>
        );
      })}
    </View>
  );
}
