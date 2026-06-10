import React from "react";
import { View, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import { useBranchStore } from "../utils/branchStore";
import KeyboardAvoidingAnimatedView from "../components/KeyboardAvoidingAnimatedView";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { PlayfairDisplay_500Medium } from "@expo-google-fonts/playfair-display";
import { useCheckoutData } from "../hooks/useCheckoutData";
import { useOrderPlacement } from "../hooks/useOrderPlacement";
import { getDateOptions } from "../utils/checkoutHelpers";
import { getTimeSlotsByOrderType } from "../utils/timeWindowHelpers";
import { CheckoutHeader } from "../components/Checkout/CheckoutHeader";
import { OrderTypeSelector } from "../components/Checkout/OrderTypeSelector";
import { DeliveryAddressSelector } from "../components/Checkout/DeliveryAddressSelector";
import { ScheduleSelector } from "../components/Checkout/ScheduleSelector";
import { SpecialInstructions } from "../components/Checkout/SpecialInstructions";
import { OrderSummary } from "../components/Checkout/OrderSummary";
import { PlaceOrderButton } from "../components/Checkout/PlaceOrderButton";
import { DatePickerModal } from "../components/Checkout/DatePickerModal";
import { TimePickerModal } from "../components/Checkout/TimePickerModal";
import { AddressPickerModal } from "../components/Checkout/AddressPickerModal";
import { PickerModal } from "../components/Checkout/PickerModal";
import { PromoCodeSection } from "../components/Checkout/PromoCodeSection";
import { RewardSection } from "../components/Checkout/RewardSection";
import { DeliveryInfoBanner } from "../components/Checkout/DeliveryInfoBanner";
import { renderRewardOption } from "../components/Checkout/RewardPickerModal";
import { useQueryClient } from "@tanstack/react-query";
import { useRedirectStore } from "../utils/redirectStore";
import { useCheckoutState } from "../hooks/useCheckoutState";
import { useDeliveryValidation } from "../hooks/useDeliveryValidation";
import { useRewardsData } from "../hooks/useRewardsData";
import { usePromoCode } from "../hooks/usePromoCode";
import { useCheckoutEffects } from "../hooks/useCheckoutEffects";
import { calculateCheckoutTotals } from "../utils/checkoutCalculations";
import {
  createCheckoutActions,
  handlePlaceOrder,
  handlePromoCodeApply,
} from "../utils/checkoutActions";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setRedirect } = useRedirectStore();
  const { colors, statusBarStyle } = useTheme();

  const { isAuthenticated, isReady, signIn } = useAuth();
  const { selectedBranch } = useBranchStore();

  // Track if user is trying to switch to delivery after selecting address
  const [pendingDeliverySwitch, setPendingDeliverySwitch] =
    React.useState(false);

  // Initialize checkout state first to get selectedAddress and orderType
  const checkoutState = useCheckoutState(null, isAuthenticated);

  const {
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
    selectedAddress: _unusedSelectedAddress,
    params,
  } = checkoutState;

  // Now fetch data - pass selectedAddressId and get selectedAddress back
  const {
    cartData,
    isLoading,
    addressesData,
    selectedAddress,
    deliveryCostData,
  } = useCheckoutData(
    selectedBranch,
    isAuthenticated,
    isReady,
    selectedAddressId,
    orderType,
  );

  // Clear promo when branch changes (promo rules are branch-aware)
  React.useEffect(() => {
    setAppliedPromo(null);
    setPromoError(null);
    setPromoCodeInput("");
  }, [selectedBranch?.id, setAppliedPromo, setPromoCodeInput, setPromoError]);

  // Auto-switch to delivery when address is selected after clicking delivery button
  React.useEffect(() => {
    if (pendingDeliverySwitch && selectedAddressId) {
      setOrderType("delivery");
      setPendingDeliverySwitch(false);
    }
  }, [pendingDeliverySwitch, selectedAddressId, setOrderType]);

  // Auto-select default address when addresses are loaded
  React.useEffect(() => {
    if (addressesData && addressesData.length > 0 && !selectedAddressId) {
      const defaultAddr =
        addressesData.find((a) => a.is_default) || addressesData[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addressesData, selectedAddressId, setSelectedAddressId]);

  const deliveryValidation = useDeliveryValidation(
    orderType,
    selectedBranch,
    selectedAddress,
  );

  const {
    hasSelectedAddressCoords,
    isDeliverableForSelectedBranch,
    deliveryDisabled,
    deliveryInfoText,
  } = deliveryValidation;

  const { clearBasketAndContinue, showOutOfBranchDeliveryAlert } =
    createCheckoutActions({
      selectedBranch,
      queryClient,
      router,
      setShowAddressPicker,
    });

  useCheckoutEffects({
    isReady,
    isAuthenticated,
    router,
    setRedirect,
    signIn,
    queryClient,
    cartData,
    isLoading,
    orderPlaced,
  });

  const orderMutation = useOrderPlacement(selectedBranch, router);

  const {
    currentPoints,
    eligibleRewards,
    eligibleUserRewards,
    combinedRewardOptions,
  } = useRewardsData(
    isAuthenticated,
    params,
    setSelectedReward,
    setSelectedUserReward,
  );

  const { promoValidateMutation } = usePromoCode();

  const dateOptions = getDateOptions();

  // Get dynamic time options based on order type, branch hours, and selected date
  const timeOptions = React.useMemo(() => {
    return getTimeSlotsByOrderType(orderType, selectedBranch, selectedDate);
  }, [orderType, selectedBranch, selectedDate]);

  // Reset selectedTime if it's not in the new time options when switching order types or dates
  React.useEffect(() => {
    const isValidTime = timeOptions.some((opt) => opt.value === selectedTime);
    if (!isValidTime && timeOptions.length > 0) {
      setSelectedTime(timeOptions[0].value);
    }
  }, [timeOptions, selectedTime, setSelectedTime]);

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_500Medium,
  });

  if (!loaded) {
    return null;
  }

  const handleGoBack = async () => {
    await Haptics.selectionAsync();
    router.back();
  };

  const formatDateTime = () => {
    const dateOption = dateOptions.find((d) => d.value === selectedDate);
    return `${dateOption?.label || selectedDate} at ${selectedTime}`;
  };

  const {
    subtotal,
    deliveryCost,
    appliedRewardDiscount,
    promoDiscount,
    total,
  } = calculateCheckoutTotals({
    cartData,
    orderType,
    deliveryCostData,
    selectedReward,
    appliedPromo,
  });

  const getSelectedAddress = () => selectedAddress;

  const onPlaceOrder = () => {
    handlePlaceOrder({
      isAuthenticated,
      orderType,
      selectedAddressId,
      hasSelectedAddressCoords,
      isDeliverableForSelectedBranch,
      cartData,
      selectedBranch,
      selectedDate,
      selectedTime,
      selectedAddress,
      specialInstructions,
      selectedReward,
      selectedUserReward,
      appliedPromo,
      orderMutation,
      setRedirect,
      signIn,
      showOutOfBranchDeliveryAlert,
      setOrderPlaced,
      queryClient,
      router,
      formatDateTime,
      total,
    });
  };

  const onApplyPromo = () => {
    handlePromoCodeApply({
      promoCodeInput,
      selectedBranch,
      promoValidateMutation,
      setAppliedPromo,
      setPromoError,
    });
  };

  const onDeliveryDisabledPress = () => {
    // Check if user has no addresses saved
    const hasNoAddresses = !addressesData || addressesData.length === 0;

    // Check if user has no address selected (even if they have addresses saved)
    const hasNoSelectedAddress = !selectedAddress;

    if (hasNoAddresses) {
      Alert.alert(
        "Add Delivery Address",
        "Please enter your address so we can deliver your order.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Add Address",
            onPress: () => router.push("/add-address"),
          },
        ],
      );
      return;
    }

    if (hasNoSelectedAddress) {
      Alert.alert(
        "Select Delivery Address",
        "Please select a delivery address to continue.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Select Address",
            onPress: () => {
              setPendingDeliverySwitch(true);
              setShowAddressPicker(true);
            },
          },
        ],
      );
      return;
    }

    if (isDeliverableForSelectedBranch === false) {
      showOutOfBranchDeliveryAlert();
      return;
    }

    Alert.alert(
      "Delivery Not Available",
      "Delivery is not available for this address. Choose another address or use Pickup.",
    );
  };

  const onRewardSelect = (option) => {
    if (option.kind === "user") {
      const found = eligibleUserRewards.find(
        (ur) => String(ur.id) === String(option.id),
      );
      setSelectedUserReward(found || null);
      setSelectedReward(null);
    } else {
      const found = eligibleRewards.find(
        (r) => Number(r.id) === Number(option.id),
      );
      setSelectedReward(found || null);
      setSelectedUserReward(null);
    }
    setShowRewardPicker(false);
  };

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />

        <CheckoutHeader
          insets={insets}
          colors={colors}
          onGoBack={handleGoBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 160,
          }}
          showsVerticalScrollIndicator={false}
        >
          <OrderTypeSelector
            orderType={orderType}
            setOrderType={setOrderType}
            colors={colors}
            deliveryDisabled={deliveryDisabled}
            onDeliveryDisabledPress={onDeliveryDisabledPress}
          />

          <DeliveryAddressSelector
            orderType={orderType}
            selectedAddressId={selectedAddressId}
            addressesData={addressesData}
            colors={colors}
            router={router}
            onShowAddressPicker={() => setShowAddressPicker(true)}
            getSelectedAddress={getSelectedAddress}
          />

          <DeliveryInfoBanner
            orderType={orderType}
            deliveryInfoText={deliveryInfoText}
            isDeliverableForSelectedBranch={isDeliverableForSelectedBranch}
            colors={colors}
          />

          <ScheduleSelector
            orderType={orderType}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            dateOptions={dateOptions}
            colors={colors}
            onShowDatePicker={() => setShowDatePicker(true)}
            onShowTimePicker={() => setShowTimePicker(true)}
          />

          <SpecialInstructions
            specialInstructions={specialInstructions}
            setSpecialInstructions={setSpecialInstructions}
            colors={colors}
          />

          <PromoCodeSection
            isAuthenticated={isAuthenticated}
            promoCodeInput={promoCodeInput}
            setPromoCodeInput={setPromoCodeInput}
            promoError={promoError}
            setPromoError={setPromoError}
            appliedPromo={appliedPromo}
            setAppliedPromo={setAppliedPromo}
            promoValidateMutation={promoValidateMutation}
            selectedBranch={selectedBranch}
            onApplyPromo={onApplyPromo}
            colors={colors}
          />

          <RewardSection
            isAuthenticated={isAuthenticated}
            selectedReward={selectedReward}
            selectedUserReward={selectedUserReward}
            combinedRewardOptions={combinedRewardOptions}
            setShowRewardPicker={setShowRewardPicker}
            setSelectedReward={setSelectedReward}
            setSelectedUserReward={setSelectedUserReward}
            colors={colors}
          />

          <OrderSummary
            cartData={cartData}
            subtotal={subtotal}
            deliveryFee={deliveryCost}
            rewardDiscount={appliedRewardDiscount}
            promoDiscount={promoDiscount}
            promoCode={appliedPromo?.code || null}
            appliedRewardTitle={selectedReward?.title || null}
            appliedNonDiscountRewardTitle={
              selectedUserReward ? selectedUserReward.title : null
            }
            total={total}
            colors={colors}
            distanceKm={deliveryCostData?.distanceKm}
            isFreeDelivery={deliveryCostData?.isFreeDelivery}
            freeDeliveryPeriodName={deliveryCostData?.freeDeliveryPeriodName}
          />
        </ScrollView>

        <PlaceOrderButton
          insets={insets}
          colors={colors}
          total={total}
          isPending={orderMutation.isPending}
          onPlaceOrder={onPlaceOrder}
        />

        <DatePickerModal
          visible={showDatePicker}
          dateOptions={dateOptions}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          onClose={() => setShowDatePicker(false)}
          insets={insets}
          colors={colors}
        />

        <TimePickerModal
          visible={showTimePicker}
          timeOptions={timeOptions}
          selectedTime={selectedTime}
          onSelect={setSelectedTime}
          onClose={() => setShowTimePicker(false)}
          insets={insets}
          colors={colors}
        />

        <AddressPickerModal
          visible={showAddressPicker}
          addressesData={addressesData}
          selectedAddressId={selectedAddressId}
          onSelect={setSelectedAddressId}
          onClose={() => setShowAddressPicker(false)}
          onAddNew={() => router.push("/add-address")}
          insets={insets}
          colors={colors}
        />

        <PickerModal
          visible={showRewardPicker}
          title={`Choose a reward (${currentPoints} pts)`}
          options={combinedRewardOptions}
          selectedValue={
            selectedUserReward
              ? { kind: "user", id: selectedUserReward.id }
              : selectedReward
                ? { kind: "points", id: selectedReward.id }
                : null
          }
          onSelect={onRewardSelect}
          onClose={() => setShowRewardPicker(false)}
          insets={insets}
          colors={colors}
          renderOption={renderRewardOption}
        />
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
