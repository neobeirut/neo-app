import React from "react";
import { View, Text } from "react-native";

export function OrderItemCard({ item, colors }) {
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

  const hasOptions = options.length > 0;
  const hasAddons = addons.length > 0;
  const hasRemovals = removals.length > 0;

  return (
    <View
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

      {item?.comment && String(item.comment).trim() ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: colors.textSecondary,
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          Note: {String(item.comment)}
        </Text>
      ) : null}

      {(hasOptions || hasAddons || hasRemovals) && (
        <View style={{ marginTop: 8, paddingLeft: 12 }}>
          {hasOptions && (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: colors.primary,
                  marginBottom: 2,
                }}
              >
                Selected Options:
              </Text>
              {options.map((custom, customIndex) => {
                const priceNumber = Number.parseFloat(custom?.price || 0);
                const hasPrice =
                  Number.isFinite(priceNumber) && priceNumber > 0;
                const priceLabel = hasPrice
                  ? ` (+$${priceNumber.toFixed(2)})`
                  : "";
                const groupPrefix = custom?.option_group_name
                  ? `${custom.option_group_name}: `
                  : "";

                return (
                  <Text
                    key={`option-${customIndex}`}
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 11,
                      color: colors.primary,
                    }}
                  >
                    {groupPrefix}
                    {custom.ingredient}
                    {priceLabel}
                  </Text>
                );
              })}
            </View>
          )}

          {hasAddons && (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: colors.text,
                  marginBottom: 2,
                }}
              >
                Add-ons:
              </Text>
              {addons.map((custom, customIndex) => {
                const priceNumber = Number.parseFloat(custom?.price || 0);
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
                      fontSize: 11,
                      color: colors.textSecondary,
                    }}
                  >
                    + {custom.ingredient}
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
                  fontSize: 11,
                  color: colors.text,
                  marginBottom: 2,
                }}
              >
                Removals:
              </Text>
              {removals.map((custom, customIndex) => (
                <Text
                  key={`remove-${customIndex}`}
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    color: colors.textSecondary,
                  }}
                >
                  - No {custom.ingredient}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
