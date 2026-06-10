import React from "react";
import { ScrollView, TouchableOpacity, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { statusOptions, getOrderCount } from "@/utils/orderHelpers";

export function StatusFilter({
  selectedStatus,
  onStatusChange,
  orders,
  colors,
}) {
  const visibleOptions = statusOptions.filter(
    (opt) => opt.value !== "accepted", // hide "Accepted" from the filter bar
  );

  // Keep the filter bar compact (no tall container).
  // User requested button height 36.
  const pillHeight = 40;
  const barHeight = 60;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 10,
        alignItems: "center",
      }}
      style={{
        height: barHeight,
        maxHeight: barHeight,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      {visibleOptions.map((option) => {
        const isSelected = selectedStatus === option.value;
        const count = getOrderCount(orders, option.value);

        const pillBg = isSelected ? option.color : colors.surface;
        const pillBorder = isSelected ? option.color : colors.separator;
        const textColor = isSelected ? "white" : option.color;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => {
              Haptics.selectionAsync();
              onStatusChange(option.value);
            }}
            style={{
              height: pillHeight,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: pillBg,
              borderWidth: 1,
              borderColor: pillBorder,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: textColor,
              }}
              numberOfLines={1}
            >
              {option.label}
            </Text>

            <View
              style={{
                minWidth: 20,
                paddingHorizontal: 6,
                height: 24,
                borderRadius: 999,
                backgroundColor: isSelected
                  ? "rgba(255,255,255,0.25)"
                  : option.color + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: textColor,
                }}
              >
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
