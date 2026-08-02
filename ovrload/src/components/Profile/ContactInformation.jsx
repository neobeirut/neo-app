import React from "react";
import { View, Text } from "react-native";
import { Phone, Mail, Calendar } from "lucide-react-native";

export function ContactInformation({ user, colors }) {
  // Format birthday to a readable format
  const formatBirthday = (birthday) => {
    if (!birthday) return null;
    const date = new Date(birthday);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 20,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        Contact Information
      </Text>

      <View style={{ gap: 16 }}>
        {/* Full Name */}
        {(user?.first_name || user?.last_name || user?.name) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 18, color: colors.primary }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                Full Name
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.name || "Not set"}
              </Text>
            </View>
          </View>
        )}

        {/* Phone Number */}
        {user?.phone && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Phone size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                Phone Number
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                {user.phone}
              </Text>
            </View>
          </View>
        )}

        {/* Email (if available) */}
        {user?.email && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Mail size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                Email Address
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                {user.email}
              </Text>
            </View>
          </View>
        )}

        {/* Birthday (if available) */}
        {user?.birthday && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Calendar size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 2,
                }}
              >
                Birthday
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                {formatBirthday(user.birthday)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
