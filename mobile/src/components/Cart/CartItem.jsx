import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { getImageSource } from "../../utils/apiFetch";

export function CartItem({
  item,
  colors,
  onRemove,
  onUpdateQuantity,
  maxQuantity,
  onPressImage,
}) {
  // ✅ iOS DEBUG: Log the item structure to see if addons/customizations are present
  console.log(`[CartItem] Rendering item #${item?.id}:`, {
    name: item?.name,
    has_addons: Array.isArray(item?.addons),
    addons_count: Array.isArray(item?.addons) ? item.addons.length : 0,
    addons_sample: item?.addons?.[0],
    has_customizations: Array.isArray(item?.customizations),
    customizations_count: Array.isArray(item?.customizations)
      ? item.customizations.length
      : 0,
    customizations_sample: item?.customizations?.[0],
  });

  const rawBase = parseFloat(item?.price);
  const basePrice = Number.isFinite(rawBase) ? rawBase : 0;

  const addonsPrice =
    item?.addons?.reduce((sum, addon) => {
      const rawAddon = parseFloat(addon?.price || 0);
      const addonPrice = Number.isFinite(rawAddon) ? rawAddon : 0;
      return sum + addonPrice;
    }, 0) || 0;

  const pricedCustomizationsPrice = (
    Array.isArray(item?.customizations) ? item.customizations : []
  ).reduce((sum, c) => {
    const t = c?.type || c?.customization_type;
    const isPriced = t === "addon" || t === "option";
    if (!isPriced) {
      return sum;
    }
    const raw = parseFloat(c?.price || 0);
    const p = Number.isFinite(raw) ? raw : 0;
    return sum + p;
  }, 0);

  const extrasPrice = addonsPrice + pricedCustomizationsPrice;

  // Separate customizations by type
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

  const isAtMax =
    typeof maxQuantity === "number" && maxQuantity >= 0
      ? item.quantity >= maxQuantity
      : false;

  const canIncrease = !isAtMax;
  const canDecrease = (item?.quantity || 0) > 0;

  const imageSource = getImageSource(
    item.image_url,
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop",
  );

  const name = item?.name || "Product";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
        gap: 12,
        position: "relative",
      }}
    >
      {/* Clickable product image opens product details in edit mode */}
      <TouchableOpacity
        onPress={() => {
          if (typeof onPressImage === "function") {
            onPressImage(item);
          }
        }}
        activeOpacity={0.85}
      >
        <Image
          source={imageSource}
          style={{
            width: 70,
            height: 70,
            borderRadius: 10,
          }}
          contentFit="cover"
          transition={200}
        />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "PlayfairDisplay_400Regular",
            fontSize: 15,
            color: colors.text,
            marginBottom: 3,
          }}
        >
          {name}
        </Text>

        {/* Options - Display FIRST without remove buttons */}
        {options.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            {options.map((option, index) => (
              <Text
                key={`option-${option.id}-${index}`}
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: colors.primary,
                  marginBottom: 2,
                }}
              >
                {option.option_group_name && `${option.option_group_name}: `}
                {option.ingredient}
              </Text>
            ))}
          </View>
        )}

        {/* Add-on customizations and Removals - without remove buttons */}
        {(addonsCustomizations.length > 0 || removals.length > 0) && (
          <View style={{ marginBottom: 3 }}>
            {addonsCustomizations.map((c, index) => (
              <Text
                key={`addon-${c.id}-${index}`}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                + {c.ingredient}
              </Text>
            ))}
            {removals.map((c, index) => (
              <Text
                key={`removal-${c.id}-${index}`}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                No {c.ingredient}
              </Text>
            ))}
          </View>
        )}

        {/* Per-item note */}
        {hasComment && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: colors.textSecondary,
              marginBottom: 3,
              fontStyle: "italic",
            }}
          >
            Note: {commentText}
          </Text>
        )}

        {/* Product Add-ons without remove buttons */}
        {item.addons && item.addons.length > 0 && (
          <View style={{ marginBottom: 3 }}>
            {item.addons.map((addon, index) => (
              <Text
                key={`addon-${addon.id || addon.addon_id}-${index}`}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                + {addon.name}
              </Text>
            ))}
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: colors.primary,
              }}
            >
              ${basePrice.toFixed(2)}
              {extrasPrice > 0 ? ` + $${extrasPrice.toFixed(2)}` : ""}
            </Text>
            {extrasPrice > 0 ? (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Unit total: ${(basePrice + extrasPrice).toFixed(2)}
              </Text>
            ) : null}
          </View>
        </View>

        {typeof maxQuantity === "number" && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: isAtMax ? "#ef4444" : colors.textSecondary,
              marginTop: 2,
            }}
          >
            Max available: {maxQuantity}
          </Text>
        )}
      </View>
      <View
        style={{
          backgroundColor: colors.primary,
          borderRadius: 10,
          width: 90,
          height: 36,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          opacity:
            typeof maxQuantity === "number" && maxQuantity <= 0 ? 0.7 : 1,
        }}
      >
        <TouchableOpacity
          onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
          disabled={!canDecrease}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 24,
            height: 24,
            justifyContent: "center",
            alignItems: "center",
            opacity: canDecrease ? 1 : 0.5,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 18,
              color: "white",
            }}
          >
            −
          </Text>
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 15,
            color: "white",
          }}
        >
          {item.quantity}
        </Text>
        <TouchableOpacity
          onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
          disabled={!canIncrease}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 24,
            height: 24,
            justifyContent: "center",
            alignItems: "center",
            opacity: canIncrease ? 1 : 0.5,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 18,
              color: "white",
            }}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
