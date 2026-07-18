import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";

export function LoadingState({ colors, statusBarStyle }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <StatusBar style={statusBarStyle} />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 16,
          color: colors.textSecondary,
          marginTop: 16,
        }}
      >
        Loading orders...
      </Text>
    </View>
  );
}
