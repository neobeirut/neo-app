import React from "react";
import { View, Text, TextInput } from "react-native";

export function SpecialInstructions({
  specialInstructions,
  setSpecialInstructions,
  colors,
}) {
  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: colors.text,
          marginBottom: 12,
        }}
      >
        Special Instructions (Optional)
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          fontFamily: "Inter_400Regular",
          fontSize: 16,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.separator,
          height: 80,
        }}
        placeholder="Any special requests or notes..."
        placeholderTextColor={colors.textSecondary}
        value={specialInstructions}
        onChangeText={setSpecialInstructions}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}
