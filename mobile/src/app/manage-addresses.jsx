import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Edit2,
  Home,
  Briefcase,
  Tag,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useFonts,
  PlayfairDisplay_500Medium,
} from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { apiFetch } from "../utils/apiFetch";

export default function ManageAddressesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const queryClient = useQueryClient();

  const [loaded] = useFonts({
    PlayfairDisplay_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Fetch addresses
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const response = await apiFetch("/api/users/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  // Set default address mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (address) => {
      const response = await apiFetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            id: address.id,
            label: address.label,
            address_line1: address.address_line1,
            building: address.building,
            company_name: address.company_name,
            address_line2: address.address_line2,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
            latitude: address.latitude,
            longitude: address.longitude,
            is_default: true,
          },
        }),
      });
      if (!response.ok) throw new Error("Failed to set default address");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "addresses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete address mutation
  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId) => {
      const response = await apiFetch("/api/users/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete address");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "addresses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Cannot Delete Address", error.message);
    },
  });

  if (!loaded || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const addresses = profileData?.addresses || [];

  const handleDelete = (address) => {
    Alert.alert(
      "Delete Address",
      `Are you sure you want to delete this address?\n\n${address.address_line1}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteAddressMutation.mutate(address.id);
          },
        },
      ],
    );
  };

  const handleEdit = async (address) => {
    await Haptics.selectionAsync();
    router.push({
      pathname: "/add-address",
      params: {
        editMode: "true",
        addressId: address.id,
        label: address.label || "",
        addressLine1: address.address_line1,
        building: address.building || "",
        companyName: address.company_name || "",
        addressLine2: address.address_line2 || "",
        city: address.city,
        state: address.state,
        latitude: address.latitude,
        longitude: address.longitude,
        isDefault: address.is_default ? "true" : "false",
      },
    });
  };

  const handleSetDefault = async (address) => {
    await Haptics.selectionAsync();
    setDefaultMutation.mutate(address);
  };

  const getLabelIcon = (label) => {
    const lowerLabel = (label || "").toLowerCase();
    if (lowerLabel.includes("home")) return Home;
    if (lowerLabel.includes("work") || lowerLabel.includes("office"))
      return Briefcase;
    return Tag;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 20,
              color: colors.text,
            }}
          >
            Manage Addresses
          </Text>

          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {addresses.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <MapPin size={64} color={colors.textSecondary} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 18,
                color: colors.text,
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              No Addresses Yet
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              Add your first delivery address to get started
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {addresses.map((address) => {
              const LabelIcon = getLabelIcon(address.label);
              return (
                <View
                  key={address.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: address.is_default ? 2 : 1,
                    borderColor: address.is_default
                      ? colors.primary
                      : colors.separator,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      {address.label && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 8,
                          }}
                        >
                          <LabelIcon size={16} color={colors.primary} />
                          <Text
                            style={{
                              fontFamily: "Inter_600SemiBold",
                              fontSize: 14,
                              color: colors.primary,
                            }}
                          >
                            {address.label}
                          </Text>
                        </View>
                      )}
                      {address.is_default && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 8,
                          }}
                        >
                          <CheckCircle size={16} color={colors.primary} />
                          <Text
                            style={{
                              fontFamily: "Inter_600SemiBold",
                              fontSize: 12,
                              color: colors.primary,
                            }}
                          >
                            DEFAULT
                          </Text>
                        </View>
                      )}
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 16,
                          color: colors.text,
                          marginBottom: 4,
                        }}
                      >
                        {address.address_line1}
                      </Text>
                      {address.building && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 14,
                            color: colors.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          {address.building}
                        </Text>
                      )}
                      {address.company_name && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 14,
                            color: colors.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          {address.company_name}
                        </Text>
                      )}
                      {address.address_line2 && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 14,
                            color: colors.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          {address.address_line2}
                        </Text>
                      )}
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 14,
                          color: colors.textSecondary,
                        }}
                      >
                        {address.city}, {address.state}
                      </Text>
                      {address.latitude != null &&
                        address.longitude != null && (
                          <Text
                            style={{
                              fontFamily: "Inter_400Regular",
                              fontSize: 11,
                              color: colors.primary,
                              marginTop: 4,
                            }}
                          >
                            📍 GPS: {Number(address.latitude).toFixed(4)},{" "}
                            {Number(address.longitude).toFixed(4)}
                          </Text>
                        )}
                    </View>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleEdit(address)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.surface,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Edit2 size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(address)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.surface,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {!address.is_default && (
                    <TouchableOpacity
                      onPress={() => handleSetDefault(address)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: colors.separator,
                      }}
                    >
                      <Circle size={16} color={colors.textSecondary} />
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 14,
                          color: colors.text,
                        }}
                      >
                        Set as default
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Address Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 24,
          paddingBottom: insets.bottom + 24,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
          onPress={async () => {
            await Haptics.selectionAsync();
            router.push("/add-address");
          }}
        >
          <Plus size={24} color="white" />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: "white",
            }}
          >
            Add New Address
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
