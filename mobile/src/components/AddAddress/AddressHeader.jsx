import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export function AddressHeader({ insets, colors, isEditMode, onBack }) {
  return (
    <View
      style={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onBack();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 20,
            color: colors.text,
          }}
        >
          {isEditMode ? "Edit Address" : "Add Address"}
        </Text>

        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}
