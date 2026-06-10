import React from "react";
import { View, Text } from "react-native";
import { MapPin } from "lucide-react-native";

export function DeliveryAddress({ address, colors }) {
  if (!address) return null;

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
        Delivery Address
      </Text>

      <View style={{ flexDirection: "row", gap: 12 }}>
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
          <MapPin size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: colors.text,
              marginBottom: 4,
            }}
          >
            {address.address_line1}
          </Text>
          {address.building && (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
            >
              {address.building}
            </Text>
          )}
          {address.address_line2 && (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
            >
              {address.address_line2}
            </Text>
          )}
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            {address.city}, {address.state}
          </Text>
        </View>
      </View>
    </View>
  );
}
