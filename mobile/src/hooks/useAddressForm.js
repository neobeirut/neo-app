import { useState, useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { phoneAuth } from "../utils/auth/phoneAuth";
import { apiFetch } from "../utils/apiFetch";

export function useAddressForm(params, router) {
  const queryClient = useQueryClient();
  const isEditMode = params.editMode === "true";
  const addressId = params.addressId;
  const hasLoadedData = useRef(false);

  const [label, setLabel] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [building, setBuilding] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [isDefault, setIsDefault] = useState(false);

  // Load existing address data if in edit mode - only once
  useEffect(() => {
    if (isEditMode && !hasLoadedData.current) {
      hasLoadedData.current = true;
      setLabel(params.label || "");
      setAddressLine1(params.addressLine1 || "");
      setBuilding(params.building || "");
      setCompanyName(params.companyName || "");
      setAddressLine2(params.addressLine2 || "");
      setCity(params.city || "");
      setState(params.state || "");
      setLatitude(params.latitude ? parseFloat(params.latitude) : null);
      setLongitude(params.longitude ? parseFloat(params.longitude) : null);
      setIsDefault(params.isDefault === "true");
    }
  }, [isEditMode]);

  const saveAddressMutation = useMutation({
    mutationFn: async (data) => {
      const phone = await phoneAuth.getUserPhone();

      const response = await apiFetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, phone }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to save address: ${response.status}`,
        );
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "addresses"] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const validation = data?.addressValidation || null;
      const isDeliverable = validation?.isDeliverable === true;
      const nearestName = validation?.nearest?.name || null;
      const distanceKmRaw = validation?.nearest?.distanceKm;
      const distanceKm =
        distanceKmRaw === null || distanceKmRaw === undefined
          ? null
          : Number(distanceKmRaw);

      let extraMessage = "";
      if (validation) {
        if (isDeliverable && nearestName) {
          const distanceText =
            distanceKm !== null && Number.isFinite(distanceKm)
              ? ` (${distanceKm.toFixed(1)} km)`
              : "";
          extraMessage = `\n\nDelivery available from ${nearestName}${distanceText}.`;
        } else {
          extraMessage =
            "\n\nDelivery is not available for this location. Please switch to Pickup.";
        }
      }

      Alert.alert(
        "Success",
        `Address ${isEditMode ? "updated" : "added"} successfully!${extraMessage}`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Save address error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to save address. Please try again.",
      );
    },
  });

  const handleSave = async () => {
    await Haptics.selectionAsync();

    // Validation
    if (!addressLine1.trim()) {
      Alert.alert("Error", "Please enter your street address");
      return;
    }
    if (!city.trim()) {
      Alert.alert("Error", "Please enter your city");
      return;
    }
    if (!state.trim()) {
      Alert.alert("Error", "Please enter your region");
      return;
    }
    if (!latitude || !longitude) {
      Alert.alert(
        "Error",
        "Please use 'Use Current Location' or 'Select a Location' to save your GPS coordinates",
      );
      return;
    }

    const addressData = {
      address: {
        label: label.trim(),
        address_line1: addressLine1.trim(),
        building: building.trim(),
        company_name: companyName.trim(),
        address_line2: addressLine2.trim(),
        city: city.trim(),
        state: state.trim(),
        latitude,
        longitude,
        is_default: isDefault,
      },
    };

    if (isEditMode && addressId) {
      addressData.address.id = parseInt(addressId);
    }

    saveAddressMutation.mutate(addressData);
  };

  const toggleDefault = async () => {
    await Haptics.selectionAsync();
    setIsDefault(!isDefault);
  };

  return {
    isEditMode,
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
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    isDefault,
    toggleDefault,
    handleSave,
    saveAddressMutation,
  };
}
