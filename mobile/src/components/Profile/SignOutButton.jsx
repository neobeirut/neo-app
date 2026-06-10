import React from "react";
import { TouchableOpacity, Text, Alert } from "react-native";
import { LogOut } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export function SignOutButton({ colors, onSignOut }) {
  const handleSignOut = async () => {
    await Haptics.selectionAsync();
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await onSignOut();
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: colors.separator,
      }}
      onPress={handleSignOut}
    >
      <LogOut size={24} color={colors.error} />
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 18,
          color: colors.error,
        }}
      >
        Sign Out
      </Text>
    </TouchableOpacity>
  );
}
