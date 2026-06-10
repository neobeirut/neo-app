import { View, Text, TouchableOpacity, ScrollView, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import { COUNTRY_CODES } from "@/utils/signupConstants";

export function CountryCodePicker({
  visible,
  countryCode,
  onSelect,
  onClose,
  insets,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom + 20,
            maxHeight: "70%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600" }}>
              Select Country Code
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.selectionAsync();
                onClose();
              }}
            >
              <Text style={{ fontSize: 16, color: "#357AFF" }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Country List */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {COUNTRY_CODES.map((country) => (
              <TouchableOpacity
                key={country.code}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  onSelect(country.code);
                  onClose();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  backgroundColor:
                    countryCode === country.code ? "#EFF6FF" : "transparent",
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{country.flag}</Text>
                  <View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight:
                          countryCode === country.code ? "600" : "400",
                        color: "#1F2937",
                      }}
                    >
                      {country.country}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: countryCode === country.code ? "600" : "500",
                    color: countryCode === country.code ? "#357AFF" : "#6B7280",
                  }}
                >
                  {country.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
