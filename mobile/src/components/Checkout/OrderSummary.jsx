import React from "react";
import { View, Text } from "react-native";

export function OrderSummary({
  cartData,
  subtotal,
  deliveryFee,
  rewardDiscount,
  promoDiscount,
  promoCode,
  appliedRewardTitle,
  appliedNonDiscountRewardTitle,
  total,
  colors,
  distanceKm,
  isFreeDelivery,
  freeDeliveryPeriodName,
}) {
  const hasRewardDiscount = Number(rewardDiscount || 0) > 0;
  const hasPromoDiscount = Number(promoDiscount || 0) > 0;
  const hasDelivery = Number(deliveryFee || 0) > 0;

  const rewardDiscountLabel = appliedRewardTitle
    ? `Reward (${appliedRewardTitle})`
    : "Discount";

  const promoLabel = promoCode ? `Promo (${promoCode})` : "Promo";

  const hasNonDiscountReward = !!appliedNonDiscountRewardTitle;

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 20,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        Order Summary
      </Text>

      {cartData?.cart_items.map((item, index) => {
        // Parse customizations
        const options = (item.customizations || []).filter((c) => {
          const t = c?.type || c?.customization_type;
          return t === "option";
        });
        const addonsCustomizations = (item.customizations || []).filter((c) => {
          const t = c?.type || c?.customization_type;
          return t === "addon";
        });
        const removals = (item.customizations || []).filter((c) => {
          const t = c?.type || c?.customization_type;
          return t === "remove";
        });

        const commentText =
          item?.comment === null || item?.comment === undefined
            ? ""
            : String(item.comment).trim();
        const hasComment = !!commentText;

        return (
          <View
            key={index}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Qty: {item.quantity}
                </Text>

                {/* Options - Display FIRST */}
                {options.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {options.map((option, idx) => (
                      <Text
                        key={`option-${option.id}-${idx}`}
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          color: colors.primary,
                          marginBottom: 2,
                        }}
                      >
                        {option.option_group_name &&
                          `${option.option_group_name}: `}
                        {option.ingredient}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Add-on customizations and Removals */}
                {(addonsCustomizations.length > 0 || removals.length > 0) && (
                  <View style={{ marginTop: 4 }}>
                    {addonsCustomizations.map((c, idx) => (
                      <Text
                        key={`addon-${c.id}-${idx}`}
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          color: colors.textSecondary,
                          marginBottom: 2,
                        }}
                      >
                        + {c.ingredient}
                      </Text>
                    ))}
                    {removals.map((c, idx) => (
                      <Text
                        key={`removal-${c.id}-${idx}`}
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          color: colors.textSecondary,
                          marginBottom: 2,
                        }}
                      >
                        No {c.ingredient}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Product Add-ons */}
                {item.addons && item.addons.length > 0 && (
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    + {item.addons.map((a) => a.name).join(", ")}
                  </Text>
                )}

                {/* Per-item note */}
                {hasComment && (
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginTop: 4,
                      fontStyle: "italic",
                    }}
                  >
                    Note: {commentText}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.primary,
                }}
              >
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          </View>
        );
      })}

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Subtotal
          </Text>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              color: colors.text,
            }}
          >
            ${Number(subtotal || 0).toFixed(2)}
          </Text>
        </View>

        {hasDelivery && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: colors.textSecondary,
                }}
              >
                Delivery
                {distanceKm !== null && distanceKm !== undefined && (
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {" "}
                    ({distanceKm.toFixed(1)} km)
                  </Text>
                )}
              </Text>
              {isFreeDelivery && freeDeliveryPeriodName && (
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: colors.success,
                    marginTop: 2,
                  }}
                >
                  🎉 {freeDeliveryPeriodName}
                </Text>
              )}
            </View>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: isFreeDelivery ? colors.success : colors.text,
              }}
            >
              {isFreeDelivery
                ? "FREE"
                : `$${Number(deliveryFee || 0).toFixed(2)}`}
            </Text>
          </View>
        )}

        {hasNonDiscountReward && !hasRewardDiscount ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 15,
                color: colors.textSecondary,
              }}
            >
              Reward ({appliedNonDiscountRewardTitle})
            </Text>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: colors.text,
              }}
            >
              $0.00
            </Text>
          </View>
        ) : null}

        {hasRewardDiscount && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 15,
                color: colors.textSecondary,
              }}
            >
              {rewardDiscountLabel}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: colors.success,
              }}
            >
              -${Number(rewardDiscount || 0).toFixed(2)}
            </Text>
          </View>
        )}

        {hasPromoDiscount && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 15,
                color: colors.textSecondary,
              }}
            >
              {promoLabel}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: colors.success,
              }}
            >
              -${Number(promoDiscount || 0).toFixed(2)}
            </Text>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
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
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: colors.primary,
            }}
          >
            ${Number(total || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}
