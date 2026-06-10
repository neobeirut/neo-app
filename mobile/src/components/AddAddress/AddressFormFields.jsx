import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { MapPin, Home, Briefcase, Tag } from "lucide-react-native";

export function AddressFormFields({
  colors,
  label,
  setLabel,
  addressLine1,
  setAddressLine1,
  building,
  setBuilding,
  companyName,
  setCompanyName,
  addressLine2,
  setAddressLine2,
  city,
  setCity,
  state,
  setState,
  isDefault,
  onToggleDefault,
}) {
  const predefinedLabels = [
    { label: "Home", icon: Home },
    { label: "Work", icon: Briefcase },
    { label: "Other", icon: Tag },
  ];

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          Address Name
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {predefinedLabels.map((item) => {
            const Icon = item.icon;
            const isSelected = label === item.label;
            return (
              <TouchableOpacity
                key={item.label}
                onPress={() => setLabel(item.label)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.separator,
                }}
              >
                <Icon
                  size={16}
                  color={isSelected ? "#FFFFFF" : colors.textSecondary}
                />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: isSelected ? "#FFFFFF" : colors.text,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          editable={true}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g., Home, Office, Apartment..."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          Street Address *
        </Text>
        <TextInput
          editable={true}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="123 Main Street"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          Building Name/Number
        </Text>
        <TextInput
          editable={true}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
          value={building}
          onChangeText={setBuilding}
          placeholder="Building A"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          Company Name (optional)
        </Text>
        <TextInput
          editable={true}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company Inc."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          Apartment, Floor, etc. (optional)
        </Text>
        <TextInput
          editable={true}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.separator,
          }}
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="Floor 4, Apt 4B"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 8,
            }}
          >
            City *
          </Text>
          <TextInput
            editable={true}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
            value={city}
            onChangeText={setCity}
            placeholder="Beirut"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 8,
            }}
          >
            Region *
          </Text>
          <TextInput
            editable={true}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
            value={state}
            onChangeText={setState}
            placeholder="Beirut"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
        }}
        onPress={onToggleDefault}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: isDefault ? colors.primary : colors.separator,
            backgroundColor: isDefault ? colors.primary : "transparent",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isDefault && <MapPin size={14} color="white" />}
        </View>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 16,
            color: colors.text,
          }}
        >
          Set as default address
        </Text>
      </TouchableOpacity>
    </View>
  );
}
