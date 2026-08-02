import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export function OrderTypeSelector({
  orderType,
  setOrderType,
  colors,
  deliveryDisabled,
  onDeliveryDisabledPress,
}) {
  const deliveryButtonOpacity = deliveryDisabled ? 0.5 : 1;

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 20,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        Order Type
      </Text>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderColor:
              orderType === "pickup" ? colors.primary : colors.separator,
            backgroundColor:
              orderType === "pickup" ? colors.primaryMuted : colors.card,
          }}
          onPress={() => setOrderType("pickup")}
        >
          <View style={{ alignItems: "center" }}>
            <Ionicons
              name="storefront"
              size={24}
              color={orderType === "pickup" ? colors.primary : colors.text}
            />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: orderType === "pickup" ? colors.primary : colors.text,
                marginTop: 8,
              }}
            >
              Pickup
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            padding: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderColor:
              orderType === "delivery" ? colors.primary : colors.separator,
            backgroundColor:
              orderType === "delivery" ? colors.primaryMuted : colors.card,
            opacity: deliveryButtonOpacity,
          }}
          onPress={() => {
            if (deliveryDisabled) {
              if (onDeliveryDisabledPress) {
                onDeliveryDisabledPress();
              }
              return;
            }
            setOrderType("delivery");
          }}
          // IMPORTANT: don't use `disabled` here; we want the user to be able
          // to tap and see WHY delivery is disabled.
        >
          <View style={{ alignItems: "center" }}>
            <Ionicons
              name="bicycle"
              size={24}
              color={orderType === "delivery" ? colors.primary : colors.text}
            />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: orderType === "delivery" ? colors.primary : colors.text,
                marginTop: 8,
              }}
            >
              Delivery
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
