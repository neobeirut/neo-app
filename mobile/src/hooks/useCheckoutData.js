import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../utils/apiFetch";
import { getAuthPhone } from "../utils/auth/getAuthPhone";
import { useCartData } from "./useCartData";

export function useCheckoutData(
  selectedBranch,
  isAuthenticated,
  isReady = true,
  selectedAddressId = null,
  orderType = "delivery",
) {
  // Cart: re-use the unified cart hook so checkout behaves the same as the cart tab.
  const cartQuery = useCartData(selectedBranch, isAuthenticated, isReady);
  const cartData = cartQuery.data || { cart_items: [] };

  // Fetch user addresses
  const { data: addressesData } = useQuery({
    queryKey: ["profile", "addresses"],
    queryFn: async () => {
      const phone = await getAuthPhone();

      const params = new URLSearchParams();
      if (phone) params.append("phone", phone);

      const qs = params.toString();
      const url = qs ? `/api/users/profile?${qs}` : "/api/users/profile";

      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch addresses");
      }
      const data = await response.json();
      return data.addresses || [];
    },
    enabled: !!isAuthenticated,
  });

  // Compute selected address from addressesData and selectedAddressId
  const selectedAddress =
    addressesData && selectedAddressId
      ? addressesData.find((a) => a.id === selectedAddressId) || null
      : null;

  // Calculate real-time delivery cost based on distance
  const { data: deliveryCostData } = useQuery({
    queryKey: [
      "deliveryCost",
      selectedBranch?.id,
      selectedAddressId,
      orderType,
    ],
    queryFn: async () => {
      // Only calculate for delivery orders with a selected address
      if (orderType !== "delivery" || !selectedAddress || !selectedBranch?.id) {
        return {
          deliveryCost: 0,
          isFreeDelivery: false,
          distanceKm: null,
          calculationMethod: "pickup_or_no_address",
        };
      }

      try {
        const response = await apiFetch("/api/delivery/calculate-cost", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            branchId: selectedBranch.id,
            addressId: selectedAddress.id,
          }),
        });

        if (!response.ok) {
          console.error("Failed to calculate delivery cost");
          return {
            deliveryCost: 5, // fallback
            isFreeDelivery: false,
            distanceKm: null,
            inDeliveryZone: true,
            calculationMethod: "error_fallback",
          };
        }

        const data = await response.json();

        return {
          deliveryCost: data.deliveryCost || 0,
          isFreeDelivery: data.isFreeDelivery || false,
          freeDeliveryPeriodName: data.freeDeliveryPeriodName,
          distanceKm: data.distanceKm,
          inDeliveryZone: data.inDeliveryZone !== false,
          maxDeliveryDistance: data.maxDeliveryDistance,
          calculationMethod: data.calculationMethod || "rule_based",
          error: data.error,
        };
      } catch (error) {
        console.error("Error calculating delivery cost:", error);
        return {
          deliveryCost: 5, // fallback
          isFreeDelivery: false,
          distanceKm: null,
          inDeliveryZone: true,
          calculationMethod: "error_fallback",
        };
      }
    },
    enabled: !!selectedBranch?.id && !!isReady,
    staleTime: 5000, // Cache for 5 seconds to avoid too many recalculations
  });

  return {
    cartData,
    isLoading: cartQuery.isLoading,
    addressesData,
    selectedAddress,
    deliveryCostData: deliveryCostData || {
      deliveryCost: 0,
      isFreeDelivery: false,
    },
  };
}
