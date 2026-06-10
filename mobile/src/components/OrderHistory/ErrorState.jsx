import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { XCircle, LogIn } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { OrderHistoryHeader } from "./OrderHistoryHeader";

export function ErrorState({
  colors,
  statusBarStyle,
  insets,
  error,
  onBack,
  onRetry,
  isAuthRequired,
  onSignIn,
}) {
  const showAuthRequired = !!isAuthRequired;

  const titleText = showAuthRequired
    ? "Sign in to see your\nOrders History"
    : "Failed to Load Orders";

  const messageText = showAuthRequired
    ? ""
    : String(error?.message || "Something went wrong");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />
      <OrderHistoryHeader colors={colors} insets={insets} onBack={onBack} />

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        {showAuthRequired ? (
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: colors.primaryMuted,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <LogIn size={36} color={colors.primary} />
          </View>
        ) : (
          <XCircle size={64} color="#EF4444" />
        )}
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 18,
            color: colors.text,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {titleText}
        </Text>
        {messageText ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {messageText}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            if (showAuthRequired) {
              if (onSignIn) {
                onSignIn();
              }
              return;
            }
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
            {showAuthRequired ? "Sign in" : "Try Again"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
