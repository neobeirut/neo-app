import React from "react";
import { View, Text } from "react-native";
import { Phone } from "lucide-react-native";

export function ProfileHeader({ user, colors }) {
  // Construct full name from first_name and last_name
  const fullName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.name || "User";

  // Get initials from first and last name, or fall back to first character of name/email
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return (
        user.first_name.charAt(0).toUpperCase() +
        user.last_name.charAt(0).toUpperCase()
      );
    }
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <View style={{ alignItems: "center", marginBottom: 32 }}>
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: colors.primary,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            fontFamily: "PlayfairDisplay_800ExtraBold",
            fontSize: 40,
            color: "white",
          }}
        >
          {getInitials()}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: "PlayfairDisplay_800ExtraBold",
          fontSize: 28,
          color: colors.text,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        {fullName}
      </Text>
      {user?.phone && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <Phone size={16} color={colors.textSecondary} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.textSecondary,
            }}
          >
            {user.phone}
          </Text>
        </View>
      )}
    </View>
  );
}
