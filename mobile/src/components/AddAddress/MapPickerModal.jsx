import React from "react";
import { View, Text, TouchableOpacity, Modal, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";

export function MapPickerModal({
  visible,
  onClose,
  insets,
  colors,
  statusBarStyle,
  mapsReady,
  MapView,
  Marker,
  PROVIDER_GOOGLE,
  mapPickerRegion,
  mapPickerCoord,
  onMapPress,
  onRegionChange,
  onMarkerDrag,
  onConfirm,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />

        <View
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.surface,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: colors.text,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 18,
              color: colors.text,
            }}
          >
            Select Location
          </Text>

          <TouchableOpacity
            onPress={onConfirm}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: "white",
              }}
            >
              Use
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            Tap anywhere on the map to drop the pin. You can also drag the pin.
          </Text>
        </View>

        <View style={{ flex: 1, marginTop: 12 }}>
          {mapsReady ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={mapPickerRegion}
              onPress={onMapPress}
              onRegionChangeComplete={onRegionChange}
            >
              {mapPickerCoord && (
                <Marker
                  coordinate={mapPickerCoord}
                  draggable
                  onDragEnd={onMarkerDrag}
                />
              )}
            </MapView>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Map not available
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                Please use "Use Current Location" or test "Select a Location" on
                your phone.
              </Text>
            </View>
          )}
        </View>

        {Platform.OS !== "web" && (
          <View
            style={{
              padding: 16,
              paddingBottom: insets.bottom + 16,
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              backgroundColor: colors.background,
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
              }}
              onPress={onConfirm}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: "white",
                }}
              >
                Use this location
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
