import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatAddress } from "@/utils/checkoutHelpers";

export function DeliveryAddressSelector({
  orderType,
  selectedAddressId,
  addressesData,
  colors,
  router,
  onShowAddressPicker,
  getSelectedAddress,
}) {
  if (orderType !== "delivery") return null;

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: colors.text,
          marginBottom: 12,
        }}
      >
        Delivery Address
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.separator,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        onPress={onShowAddressPicker}
      >
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: selectedAddressId ? colors.text : colors.textSecondary,
            flex: 1,
          }}
          numberOfLines={2}
        >
          {formatAddress(getSelectedAddress())}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      {addressesData && addressesData.length === 0 && (
        <TouchableOpacity
          style={{ marginTop: 8 }}
          onPress={() => router.push("/add-address")}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: colors.primary,
            }}
          >
            + Add a delivery address
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
