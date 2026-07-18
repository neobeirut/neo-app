import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { PickerModal } from "./PickerModal";

export function TimePickerModal({
  visible,
  timeOptions,
  selectedTime,
  onSelect,
  onClose,
  insets,
  colors,
}) {
  const renderTimeOption = (time, selectedValue, onSelectValue, colors) => {
    // Handle both string format and {label, value} object format
    const timeValue = typeof time === "string" ? time : time.value;
    const timeLabel = typeof time === "string" ? time : time.label;

    return (
      <TouchableOpacity
        key={timeValue}
        style={{
          padding: 20,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          backgroundColor:
            selectedValue === timeValue ? colors.primaryMuted : "transparent",
        }}
        onPress={() => {
          onSelectValue(timeValue);
          onClose();
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 16,
            color: selectedValue === timeValue ? colors.primary : colors.text,
          }}
        >
          {timeLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <PickerModal
      visible={visible}
      title="Select Time"
      options={timeOptions}
      selectedValue={selectedTime}
      onSelect={onSelect}
      onClose={onClose}
      insets={insets}
      colors={colors}
      renderOption={renderTimeOption}
    />
  );
}
