import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Gift } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export function UnauthenticatedView({ colors, signIn }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.primaryMuted,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Gift size={40} color={colors.primary} />
      </View>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 24,
          color: colors.text,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Sign in to view your rewards
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 16,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        Create an account to start earning points and redeeming rewards
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: colors.primary,
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 32,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 6,
        }}
        onPress={async () => {
          await Haptics.selectionAsync();
          signIn();
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 18,
            color: "white",
          }}
        >
          Sign In / Sign Up
        </Text>
      </TouchableOpacity>
    </View>
  );
}
