import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Home, Briefcase, Tag } from "lucide-react-native";
import { formatAddress } from "@/utils/checkoutHelpers";

export function AddressPickerModal({
  visible,
  addressesData,
  selectedAddressId,
  onSelect,
  onClose,
  onAddNew,
  insets,
  colors,
}) {
  const addresses = addressesData || [];

  const getLabelIcon = (label) => {
    const lowerLabel = (label || "").toLowerCase();
    if (lowerLabel.includes("home")) return Home;
    if (lowerLabel.includes("work") || lowerLabel.includes("office"))
      return Briefcase;
    return Tag;
  };

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
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.separator,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
              }}
            >
              Select Address
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {addresses.map((addr) => {
              const LabelIcon = getLabelIcon(addr.label);
              return (
                <TouchableOpacity
                  key={addr.id}
                  style={{
                    padding: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.separator,
                    backgroundColor:
                      selectedAddressId === addr.id
                        ? colors.primaryMuted
                        : "transparent",
                  }}
                  onPress={() => {
                    onSelect(addr.id);
                    onClose();
                  }}
                >
                  {addr.label && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <LabelIcon
                        size={14}
                        color={
                          selectedAddressId === addr.id
                            ? colors.primary
                            : colors.textSecondary
                        }
                      />
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                          color:
                            selectedAddressId === addr.id
                              ? colors.primary
                              : colors.textSecondary,
                        }}
                      >
                        {addr.label}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color:
                        selectedAddressId === addr.id
                          ? colors.primary
                          : colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {formatAddress(addr)}
                  </Text>
                  {addr.is_default && (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: colors.primary,
                      }}
                    >
                      Default
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={{
                padding: 20,
                backgroundColor: colors.card,
                alignItems: "center",
              }}
              onPress={() => {
                onClose();
                onAddNew();
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.primary,
                }}
              >
                + Add New Address
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
