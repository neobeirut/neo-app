import React from "react";
import { View, Text } from "react-native";
import { format, parseISO } from "date-fns";

export function OrderDetailsSection({ order, colors }) {
  const formatScheduled = (dateStr, timeStr) => {
    try {
      const datePart = dateStr ? format(parseISO(dateStr), "dd-MM-yyyy") : "";
      const timePart = typeof timeStr === "string" ? timeStr.slice(0, 5) : ""; // HH:MM:SS -> HH:MM

      if (datePart && timePart) {
        return `${datePart} at ${timePart}`;
      }
      if (datePart) {
        return datePart;
      }
      if (timePart) {
        return timePart;
      }
      return "";
    } catch (error) {
      console.error("Could not format scheduled date/time", error);
      const fallbackDate = dateStr || "";
      const fallbackTime = timeStr || "";
      const hasBoth = fallbackDate && fallbackTime;
      return hasBoth
        ? `${fallbackDate} at ${fallbackTime}`
        : fallbackDate || fallbackTime;
    }
  };

  const scheduledText = formatScheduled(
    order?.scheduled_date,
    order?.scheduled_time,
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          color: colors.text,
          marginBottom: 8,
        }}
      >
        Order Details
      </Text>
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          Type:{" "}
          {order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1)}
        </Text>

        {scheduledText ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Scheduled: {scheduledText}
          </Text>
        ) : null}

        {order.delivery_address && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Address: {order.delivery_address}
          </Text>
        )}
        {order.building && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Building: {order.building}
          </Text>
        )}
        {order.company_name && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Company: {order.company_name}
          </Text>
        )}
        {order.address_line2 && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            {order.address_line2}
          </Text>
        )}
        {order.branch_name && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Branch: {order.branch_name}
          </Text>
        )}
        {order.special_instructions && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            Note: {order.special_instructions}
          </Text>
        )}
      </View>
    </View>
  );
}
