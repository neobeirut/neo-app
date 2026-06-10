import { useState, useMemo } from "react";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

function safeLoadReactNativeMaps() {
  if (Platform.OS === "web") {
    return null;
  }
  try {
    const mod = require("react-native-maps");
    return mod;
  } catch (e) {
    console.error("[add-address] Failed to load react-native-maps:", e);
    return null;
  }
}

export function useLocationPicker(
  latitude,
  longitude,
  setLatitude,
  setLongitude,
  setAddressLine1,
  setCity,
  setState,
) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [mapPickerCoord, setMapPickerCoord] = useState(null);
  const [mapPickerRegion, setMapPickerRegion] = useState({
    latitude: 33.8938,
    longitude: 35.5018,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const mapsModule = useMemo(() => safeLoadReactNativeMaps(), []);
  const MapView = mapsModule ? mapsModule.default || mapsModule : null;
  const Marker = mapsModule?.Marker;
  const PROVIDER_GOOGLE = mapsModule?.PROVIDER_GOOGLE;
  const mapsReady = !!MapView && !!Marker;

  const hasCoords = latitude !== null && longitude !== null;

  const tryAutofillFromGoogle = async (lat, lng) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`,
      );
      const data = await response.json();

      if (data.results && data.results[0]) {
        const addressComponents = data.results[0].address_components;
        let street = "";
        let cityName = "";
        let stateName = "";

        addressComponents.forEach((component) => {
          if (component.types.includes("street_number")) {
            street = component.long_name + " ";
          }
          if (component.types.includes("route")) {
            street += component.long_name;
          }
          if (component.types.includes("locality")) {
            cityName = component.long_name;
          }
          if (component.types.includes("administrative_area_level_1")) {
            stateName = component.short_name;
          }
        });

        if (street) setAddressLine1(street.trim());
        if (cityName) setCity(cityName);
        if (stateName) setState(stateName);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
  };

  const openMapPicker = async () => {
    await Haptics.selectionAsync();

    if (!mapsReady) {
      Alert.alert(
        "Map not available",
        Platform.OS === "web"
          ? "Map selection isn't available in web preview. Please test this on your phone."
          : "Map selection isn't available on this device.",
      );
      return;
    }

    const initialLat = hasCoords ? latitude : 33.8938;
    const initialLng = hasCoords ? longitude : 35.5018;

    setMapPickerCoord({ latitude: initialLat, longitude: initialLng });
    setMapPickerRegion({
      latitude: initialLat,
      longitude: initialLng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setMapPickerVisible(true);
  };

  const confirmMapSelection = async () => {
    if (!mapPickerCoord) {
      Alert.alert("Select a location", "Tap on the map to choose a location.");
      return;
    }

    setLatitude(mapPickerCoord.latitude);
    setLongitude(mapPickerCoord.longitude);

    await tryAutofillFromGoogle(
      mapPickerCoord.latitude,
      mapPickerCoord.longitude,
    );

    setMapPickerVisible(false);

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Location Saved",
      "Your selected map location has been saved. The delivery team will see your exact coordinates.",
    );
  };

  const handleUseCurrentLocation = async () => {
    await Haptics.selectionAsync();

    Alert.alert(
      "Location Permission Required",
      "We need your precise location to:\n\n• Provide accurate delivery services\n• Auto-fill your address details\n• Show your location on the map for the delivery team\n\nYour location data will be:\n• Stored securely on our servers\n• Shared with Google Maps API for address lookup\n• Visible to our delivery team for order fulfillment\n\nDo you consent to sharing your location?",
      [
        {
          text: "No, Enter Manually",
          style: "cancel",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
        {
          text: "Yes, Allow Location",
          onPress: async () => {
            await requestAndUseLocation();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const requestAndUseLocation = async () => {
    setLoadingLocation(true);

    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude: lat, longitude: lng } = position.coords;
            setLatitude(lat);
            setLongitude(lng);

            try {
              await tryAutofillFromGoogle(lat, lng);

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert(
                "Location Saved",
                "Your GPS location has been saved. The delivery team will see your exact coordinates along with your address for accurate delivery.",
              );
            } catch (error) {
              console.error("Geocoding error:", error);
              Alert.alert(
                "Location Saved",
                "GPS coordinates saved. Please enter your address manually.",
              );
            }
            setLoadingLocation(false);
          },
          (error) => {
            console.error("Geolocation error:", error);
            Alert.alert(
              "Location Error",
              "Failed to get your current location. Please enable location permissions in your device settings and try again.",
            );
            setLoadingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } else {
        const Location = require("expo-location");

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required to use this feature. Please enable it in your device settings to allow us to provide accurate delivery services.",
          );
          setLoadingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

        setLatitude(lat);
        setLongitude(lng);

        await tryAutofillFromGoogle(lat, lng);

        const [address] = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (address) {
          if (address.street) {
            const streetNumber = address.streetNumber || "";
            const street = address.street || "";
            setAddressLine1(`${streetNumber} ${street}`.trim());
          }
          if (address.city) setCity(address.city);
          if (address.region) setState(address.region);

          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          Alert.alert(
            "Location Saved",
            "Your GPS location has been saved. The delivery team will see your exact coordinates along with your address for accurate delivery.",
          );
        } else {
          Alert.alert(
            "Unable to Get Address",
            "We couldn't determine your address from your location. Please enter it manually.",
          );
        }
        setLoadingLocation(false);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert(
        "Location Error",
        "Failed to get your current location. Please try again or enter your address manually.",
      );
      setLoadingLocation(false);
    }
  };

  return {
    loadingLocation,
    mapPickerVisible,
    setMapPickerVisible,
    mapPickerCoord,
    setMapPickerCoord,
    mapPickerRegion,
    setMapPickerRegion,
    mapsReady,
    MapView,
    Marker,
    PROVIDER_GOOGLE,
    hasCoords,
    openMapPicker,
    confirmMapSelection,
    handleUseCurrentLocation,
  };
}
