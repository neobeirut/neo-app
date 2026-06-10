import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";

export function useCheckoutState(addressesData, isAuthenticated) {
  const params = useLocalSearchParams();

  const [orderType, setOrderType] = useState("pickup");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedTime, setSelectedTime] = useState("10:00 AM");
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [showRewardPicker, setShowRewardPicker] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [selectedUserReward, setSelectedUserReward] = useState(null);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState(null);

  // Selected address (memo so we can use it in queries / UI)
  const selectedAddress = useMemo(() => {
    if (!addressesData || !selectedAddressId) return null;
    return addressesData.find((a) => a.id === selectedAddressId) || null;
  }, [addressesData, selectedAddressId]);

  // Set default address when addresses load
  useEffect(() => {
    if (addressesData && addressesData.length > 0 && !selectedAddressId) {
      const defaultAddr =
        addressesData.find((a) => a.is_default) || addressesData[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addressesData, selectedAddressId]);

  return {
    orderType,
    setOrderType,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    selectedAddressId,
    setSelectedAddressId,
    specialInstructions,
    setSpecialInstructions,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showAddressPicker,
    setShowAddressPicker,
    orderPlaced,
    setOrderPlaced,
    showRewardPicker,
    setShowRewardPicker,
    selectedReward,
    setSelectedReward,
    selectedUserReward,
    setSelectedUserReward,
    promoCodeInput,
    setPromoCodeInput,
    appliedPromo,
    setAppliedPromo,
    promoError,
    setPromoError,
    selectedAddress,
    params,
  };
}
