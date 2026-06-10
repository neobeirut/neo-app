import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { PickerModal } from "./PickerModal";

export function DatePickerModal({
  visible,
  dateOptions,
  selectedDate,
  onSelect,
  onClose,
  insets,
  colors,
}) {
  const renderDateOption = (date, selectedValue, onSelectValue, colors) => (
    <TouchableOpacity
      key={date.value}
      style={{
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor:
          selectedValue === date.value ? colors.primaryMuted : "transparent",
      }}
      onPress={() => {
        onSelectValue(date.value);
        onClose();
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 16,
          color: selectedValue === date.value ? colors.primary : colors.text,
        }}
      >
        {date.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <PickerModal
      visible={visible}
      title="Select Date"
      options={dateOptions}
      selectedValue={selectedDate}
      onSelect={onSelect}
      onClose={onClose}
      insets={insets}
      colors={colors}
      renderOption={renderDateOption}
    />
  );
}
