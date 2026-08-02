import React from "react";
import { View, Text } from "react-native";
import { statusOptions } from "@/utils/orderHelpers";

export function OrderDetails({ order, colors }) {
  const statusLabel =
    statusOptions.find((opt) => opt.value === order.status)?.label ||
    order.status;

  const formatScheduled = (dateStr, timeStr) => {
    if (!dateStr) {
      return "";
    }

    let day = "";
    let month = "";
    let year = "";

    // most common: YYYY-MM-DD
    if (typeof dateStr === "string" && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length >= 3 && parts[0].length === 4) {
        year = parts[0];
        month = String(parts[1] || "").padStart(2, "0");
        day = String(parts[2] || "").padStart(2, "0");
      }
    }

    // fallback: try Date parsing
    if (!day || !month || !year) {
      const d = new Date(dateStr);
      if (!Number.isNaN(d.getTime())) {
        day = String(d.getDate()).padStart(2, "0");
        month = String(d.getMonth() + 1).padStart(2, "0");
        year = String(d.getFullYear());
      }
    }

    const rawTime = timeStr ? String(timeStr) : "";
    const hhmm = rawTime.length >= 5 ? rawTime.slice(0, 5) : "";
    const timeLabel = hhmm || "00:00";

    const dateLabel =
      day && month && year ? `${day}/${month}/${year}` : String(dateStr);
    return `${dateLabel} at ${timeLabel}`;
  };

  const scheduledLabel = formatScheduled(
    order.scheduled_date,
    order.scheduled_time,
  );

  const scheduledDisplay = scheduledLabel ? `(${scheduledLabel})` : "";

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
          Status: {statusLabel}
        </Text>
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
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          Scheduled: {scheduledDisplay}
        </Text>
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
