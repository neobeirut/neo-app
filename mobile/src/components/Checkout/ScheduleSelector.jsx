import React from "react";
import { View, Text, TouchableOpacity, Switch, Platform } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export function ScheduleSelector({
  orderType,
  selectedDate,
  selectedTime,
  dateOptions,
  colors,
  onShowDatePicker,
  onShowTimePicker,
  isScheduled,
  onToggleScheduled,
}) {
  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 20,
            color: colors.text,
          }}
        >
          Schedule {orderType === "delivery" ? "Delivery" : "Pickup"}
        </Text>
        <Switch
          value={isScheduled}
          onValueChange={onToggleScheduled}
          trackColor={{ false: colors.separator, true: colors.primary }}
          thumbColor={Platform.OS === "android" ? (isScheduled ? colors.background : "#f4f3f4") : undefined}
        />
      </View>

      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: isScheduled ? colors.text : colors.textSecondary,
          marginBottom: 12,
        }}
      >
        Date
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: isScheduled ? colors.card : colors.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.separator,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          opacity: isScheduled ? 1 : 0.5,
        }}
        onPress={onShowDatePicker}
        disabled={!isScheduled}
      >
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: isScheduled ? colors.text : colors.textSecondary,
          }}
        >
          {dateOptions.find((d) => d.value === selectedDate)?.label ||
            selectedDate}
        </Text>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={isScheduled ? colors.textSecondary : colors.border}
        />
      </TouchableOpacity>

      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: isScheduled ? colors.text : colors.textSecondary,
          marginBottom: 12,
        }}
      >
        Time
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: isScheduled ? colors.card : colors.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.separator,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: isScheduled ? 1 : 0.5,
        }}
        onPress={onShowTimePicker}
        disabled={!isScheduled}
      >
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: isScheduled ? colors.text : colors.textSecondary,
          }}
        >
          {selectedTime}
        </Text>
        <Ionicons
          name="time-outline"
          size={20}
          color={isScheduled ? colors.textSecondary : colors.border}
        />
      </TouchableOpacity>
    </View>
  );
}
