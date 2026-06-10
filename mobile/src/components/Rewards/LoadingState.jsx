import React from "react";
import { View, ActivityIndicator } from "react-native";
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
    </View>
  );
}
