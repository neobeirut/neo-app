import React from "react";
import { View, Text } from "react-native";

export function ActivityItem({ item, colors }) {
  return (
    <View
      key={item.id}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          backgroundColor: colors.surface,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        <item.icon size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 16,
            color: colors.text,
            marginBottom: 2,
          }}
        >
          {item.description}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          {item.date}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: item.points < 0 ? colors.error : colors.success,
        }}
      >
        {item.points > 0 ? "+" : ""}
        {item.points}
      </Text>
    </View>
  );
}
