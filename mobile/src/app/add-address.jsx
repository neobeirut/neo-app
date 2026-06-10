import React from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../utils/theme";
import KeyboardAvoidingAnimatedView from "../components/KeyboardAvoidingAnimatedView";
import { useAddressForm } from "../hooks/useAddressForm";
import { useLocationPicker } from "../hooks/useLocationPicker";
import { AddressHeader } from "../components/AddAddress/AddressHeader";
import { LocationButtons } from "../components/AddAddress/LocationButtons";
import { CoordinatesDisplay } from "../components/AddAddress/CoordinatesDisplay";
import { AddressFormFields } from "../components/AddAddress/AddressFormFields";
import { SaveButton } from "../components/AddAddress/SaveButton";
import { MapPickerModal } from "../components/AddAddress/MapPickerModal";

export default function AddAddressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, statusBarStyle } = useTheme();

  const {
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
  } = useAddressForm(params, router);

  const {
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
  } = useLocationPicker(
    latitude,
    longitude,
    setLatitude,
    setLongitude,
    setAddressLine1,
    setCity,
    setState,
  );

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
    >
      <StatusBar style={statusBarStyle} />

      <AddressHeader
        insets={insets}
        colors={colors}
        isEditMode={isEditMode}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 200,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LocationButtons
          colors={colors}
          hasCoords={hasCoords}
          loadingLocation={loadingLocation}
          onUseCurrentLocation={handleUseCurrentLocation}
          onSelectLocation={openMapPicker}
        />

        <CoordinatesDisplay
          colors={colors}
          latitude={latitude}
          longitude={longitude}
        />

        <AddressFormFields
          colors={colors}
          label={label}
          setLabel={setLabel}
          addressLine1={addressLine1}
          setAddressLine1={setAddressLine1}
          building={building}
          setBuilding={setBuilding}
          companyName={companyName}
          setCompanyName={setCompanyName}
          addressLine2={addressLine2}
          setAddressLine2={setAddressLine2}
          city={city}
          setCity={setCity}
          state={state}
          setState={setState}
          isDefault={isDefault}
          onToggleDefault={toggleDefault}
        />
      </ScrollView>

      <MapPickerModal
        visible={mapPickerVisible}
        onClose={() => setMapPickerVisible(false)}
        insets={insets}
        colors={colors}
        statusBarStyle={statusBarStyle}
        mapsReady={mapsReady}
        MapView={MapView}
        Marker={Marker}
        PROVIDER_GOOGLE={PROVIDER_GOOGLE}
        mapPickerRegion={mapPickerRegion}
        mapPickerCoord={mapPickerCoord}
        onMapPress={(e) => {
          const coord = e.nativeEvent.coordinate;
          setMapPickerCoord(coord);
        }}
        onRegionChange={(region) => {
          setMapPickerRegion(region);
        }}
        onMarkerDrag={(e) => {
          const coord = e.nativeEvent.coordinate;
          setMapPickerCoord(coord);
        }}
        onConfirm={confirmMapSelection}
      />

      <SaveButton
        insets={insets}
        colors={colors}
        isEditMode={isEditMode}
        isLoading={saveAddressMutation.isLoading}
        onSave={handleSave}
      />
    </KeyboardAvoidingAnimatedView>
  );
}
