import React from "react";
import { View, Text } from "react-native";

export function CoordinatesDisplay({ colors, latitude, longitude }) {
  if (latitude === null || longitude === null) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 12,
          color: colors.textSecondary,
          marginBottom: 4,
        }}
      >
        GPS Coordinates Saved
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: colors.textSecondary,
        }}
      >
        Lat: {latitude.toFixed(6)}, Long: {longitude.toFixed(6)}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: colors.textSecondary,
          marginTop: 4,
        }}
      >
        The admin will see your exact location on the map
      </Text>
    </View>
  );
}
