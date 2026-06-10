import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Circle, CheckCircle2 } from "lucide-react-native";

export function OptionsSection({
  customizations,
  colors,
  isAvailable,
  canAddToCart,
  selectedOptions,
  onToggleOption,
}) {
  // Filter for options only and group them by option_group_name
  const options = customizations.filter(
    (c) => c.customization_type === "option",
  );

  if (options.length === 0) return null;

  // Group options by option_group_name
  const optionGroups = options.reduce((acc, option) => {
    const groupName = option.option_group_name || "Options";
    if (!acc[groupName]) {
      acc[groupName] = {
        name: groupName,
        options: [],
        is_required: option.is_required || false,
        is_multi_select: option.is_multi_select || false,
        display_order: option.display_order || 0,
      };
    }
    acc[groupName].options.push(option);
    return acc;
  }, {});

  // Sort groups by display_order
  const sortedGroups = Object.values(optionGroups).sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 18,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        Options
      </Text>

      {sortedGroups.map((group, groupIndex) => {
        const groupKey = group.name;
        const selectedForGroup = selectedOptions[groupKey] || [];

        // IMPORTANT UX:
        // Within each group, show the default choice at the top.
        // Priority: per-product default (is_default_for_product) > global group default (is_default) > display_order > ingredient
        const sortedOptions = (
          Array.isArray(group.options) ? group.options : []
        )
          .slice()
          .sort((a, b) => {
            const ap = a?.is_default_for_product ? 1 : 0;
            const bp = b?.is_default_for_product ? 1 : 0;
            if (ap !== bp) return bp - ap;

            const ag = a?.is_default ? 1 : 0;
            const bg = b?.is_default ? 1 : 0;
            if (ag !== bg) return bg - ag;

            const da = Number(a?.display_order ?? 999999);
            const db = Number(b?.display_order ?? 999999);
            if (da !== db) return da - db;

            return String(a?.ingredient || "").localeCompare(
              String(b?.ingredient || ""),
            );
          });

        return (
          <View
            key={groupKey}
            style={{
              marginBottom: groupIndex < sortedGroups.length - 1 ? 20 : 0,
            }}
          >
            {/* Group Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: colors.text,
                }}
              >
                {group.name}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {group.is_required && (
                  <View
                    style={{
                      backgroundColor: colors.error + "15",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 11,
                        color: colors.error,
                      }}
                    >
                      Required
                    </Text>
                  </View>
                )}
                {group.is_multi_select && (
                  <View
                    style={{
                      backgroundColor: colors.primary + "15",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 11,
                        color: colors.primary,
                      }}
                    >
                      Multi
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Option Choices */}
            <View style={{ gap: 8 }}>
              {sortedOptions.map((option) => {
                const isSelected = selectedForGroup.includes(option.id);
                const hasPrice = parseFloat(option.price || 0) > 0;

                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => onToggleOption(groupKey, option.id)}
                    disabled={!canAddToCart}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: isSelected
                        ? colors.primary + "10"
                        : "white",
                      padding: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.primary : "#E5E5E5",
                      opacity: !canAddToCart ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                        gap: 12,
                      }}
                    >
                      {isSelected ? (
                        <CheckCircle2
                          size={22}
                          color={colors.primary}
                          fill={colors.primary}
                        />
                      ) : (
                        <Circle size={22} color="#9CA3AF" />
                      )}
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 15,
                          color: colors.text,
                          flex: 1,
                        }}
                      >
                        {option.ingredient}
                      </Text>
                    </View>
                    {hasPrice && (
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 14,
                          color: isSelected ? colors.primary : colors.textLight,
                        }}
                      >
                        +${parseFloat(option.price).toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
