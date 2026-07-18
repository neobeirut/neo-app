import React from "react";
import { ScrollView, TouchableOpacity, Text } from "react-native";
import * as Haptics from "expo-haptics";
import {
  statusOptions,
  getStatusCount,
  getStatusColor,
} from "@/utils/orderHistoryHelpers";

export function StatusFilterBar({
  colors,
  selectedStatus,
  onStatusChange,
  orders,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingVertical: 16,
        gap: 12,
      }}
      style={{
        flexGrow: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      {statusOptions.map((option) => {
        const isSelected = selectedStatus === option.value;
        const count = getStatusCount(orders, option.value);
        const optionColor = getStatusColor(
          option.value === "all" ? "default" : option.value,
        );

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => {
              Haptics.selectionAsync();
              onStatusChange(option.value);
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isSelected ? optionColor : colors.surface,
              borderWidth: 1,
              borderColor: isSelected ? optionColor : colors.separator,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: isSelected ? "white" : optionColor,
              }}
            >
              {option.label} ({count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
