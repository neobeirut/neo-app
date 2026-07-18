import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Navigation, MapPin } from "lucide-react-native";

export function LocationButtons({
  colors,
  hasCoords,
  loadingLocation,
  onUseCurrentLocation,
  onSelectLocation,
}) {
  return (
    <View style={{ gap: 12, marginBottom: 24 }}>
      <TouchableOpacity
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: colors.separator,
          opacity: loadingLocation ? 0.7 : 1,
        }}
        onPress={onUseCurrentLocation}
        disabled={loadingLocation}
      >
        {loadingLocation ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Navigation size={20} color={colors.text} />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: colors.text,
              }}
            >
              {hasCoords ? "✓ Location Saved" : "Use Current Location"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: colors.separator,
        }}
        onPress={onSelectLocation}
      >
        <MapPin size={20} color={colors.text} />
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: colors.text,
          }}
        >
          Select a Location
        </Text>
      </TouchableOpacity>
    </View>
  );
}
