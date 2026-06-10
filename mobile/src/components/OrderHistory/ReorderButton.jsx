import React from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { RefreshCw } from "lucide-react-native";

export function ReorderButton({ colors, onPress, isLoading }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      style={{
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <RefreshCw size={18} color="white" />
      )}
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          color: "white",
        }}
      >
        {isLoading ? "Adding to Cart..." : "Reorder"}
      </Text>
    </TouchableOpacity>
  );
}
