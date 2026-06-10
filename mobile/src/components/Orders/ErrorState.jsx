import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { XCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { OrderHeader } from "./OrderHeader";

export function ErrorState({
  error,
  insets,
  colors,
  statusBarStyle,
  onBack,
  onRetry,
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />
      <OrderHeader insets={insets} colors={colors} onBack={onBack} />

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <XCircle size={64} color="#EF4444" />
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 18,
            color: colors.text,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Access Denied
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {error.message}
        </Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onRetry();
          }}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
            marginTop: 24,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "white",
            }}
          >
            Try Again
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
