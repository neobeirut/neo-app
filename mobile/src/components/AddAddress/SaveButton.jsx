import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Save } from "lucide-react-native";

export function SaveButton({ insets, colors, isEditMode, isLoading, onSave }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: insets.bottom + 24,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
      }}
    >
      <TouchableOpacity
        style={{
          backgroundColor: colors.primary,
          borderRadius: 16,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          opacity: isLoading ? 0.6 : 1,
        }}
        onPress={onSave}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Save size={24} color="white" />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: "white",
              }}
            >
              {isEditMode ? "Update Address" : "Save Address"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
