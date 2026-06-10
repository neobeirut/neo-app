import { useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";

export function useCheckoutEffects({
  isReady,
  isAuthenticated,
  router,
  setRedirect,
  signIn,
  queryClient,
  cartData,
  isLoading,
  orderPlaced,
}) {
  // SIGN-IN ENFORCEMENT: Check if user is authenticated when checkout loads
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      Alert.alert(
        "Sign In Required",
        "You need to sign in to proceed with checkout. Your cart items will be saved.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => router.back(),
          },
          {
            text: "Sign In",
            onPress: () => {
              setRedirect("/checkout");
              signIn();
            },
          },
        ],
        { cancelable: false },
      );
    }
  }, [isReady, isAuthenticated, router, setRedirect, signIn]);

  // Refetch addresses on focus so the new address shows immediately
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["profile", "addresses"] });
    }, [isAuthenticated, queryClient]),
  );

  // Only redirect to cart if empty AND no order was just placed
  useEffect(() => {
    const hasNoItems =
      cartData && Array.isArray(cartData.cart_items)
        ? cartData.cart_items.length === 0
        : true;

    if (!isLoading && hasNoItems && !orderPlaced) {
      router.replace("/(tabs)/cart");
    }
  }, [cartData, orderPlaced, router, isLoading]);
}
