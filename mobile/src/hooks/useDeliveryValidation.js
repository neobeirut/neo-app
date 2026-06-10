import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";

export function useDeliveryValidation(
  orderType,
  selectedBranch,
  selectedAddress,
) {
  const selectedAddressLat =
    selectedAddress?.latitude === null ||
    selectedAddress?.latitude === undefined
      ? null
      : Number(selectedAddress.latitude);

  const selectedAddressLng =
    selectedAddress?.longitude === null ||
    selectedAddress?.longitude === undefined
      ? null
      : Number(selectedAddress.longitude);

  const hasSelectedAddressCoords =
    selectedAddressLat !== null &&
    Number.isFinite(selectedAddressLat) &&
    selectedAddressLng !== null &&
    Number.isFinite(selectedAddressLng);

  const selectedBranchId = selectedBranch?.id || null;

  const { data: deliveryValidationData } = useQuery({
    queryKey: [
      "delivery-validate",
      selectedBranchId,
      selectedAddress?.id,
      selectedAddressLat,
      selectedAddressLng,
    ],
    queryFn: async () => {
      const response = await apiFetch("/api/delivery/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: selectedBranchId,
          latitude: selectedAddressLat,
          longitude: selectedAddressLng,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `When fetching /api/delivery/validate, the response was [${response.status}] ${response.statusText} ${text}`,
        );
      }

      return response.json();
    },
    enabled:
      orderType === "delivery" &&
      hasSelectedAddressCoords &&
      !!selectedBranchId,
    retry: 0,
  });

  const isDeliverableForSelectedBranch = useMemo(() => {
    if (
      deliveryValidationData &&
      deliveryValidationData.isDeliverable === true
    ) {
      return true;
    }
    if (
      deliveryValidationData &&
      deliveryValidationData.isDeliverable === false
    ) {
      return false;
    }
    return null; // unknown (no validation yet)
  }, [deliveryValidationData]);

  const deliveryDisabled =
    !selectedAddress ||
    !hasSelectedAddressCoords ||
    !selectedBranchId ||
    isDeliverableForSelectedBranch === false;

  const selectedBranchNameForUi = selectedBranch?.name || "this branch";

  const deliveryInfoText = useMemo(() => {
    if (orderType !== "delivery") return null;

    if (!selectedBranchId) {
      return "Please choose a branch first.";
    }

    if (!selectedAddress) {
      return "Select an address to check delivery.";
    }

    if (!hasSelectedAddressCoords) {
      return "This address is missing GPS coordinates. Please edit it and drop a pin.";
    }

    if (isDeliverableForSelectedBranch === false) {
      return `This address isn't eligible for delivery from ${selectedBranchNameForUi}.`;
    }

    const distanceRaw = deliveryValidationData?.branch?.distanceKm;
    const distanceKm =
      distanceRaw === null || distanceRaw === undefined
        ? null
        : Number(distanceRaw);

    const distanceText =
      distanceKm !== null && Number.isFinite(distanceKm)
        ? ` (${distanceKm.toFixed(1)} km)`
        : "";

    if (isDeliverableForSelectedBranch === true) {
      return `Delivery available from ${selectedBranchNameForUi}${distanceText}.`;
    }

    return "Checking delivery availability...";
  }, [
    deliveryValidationData,
    hasSelectedAddressCoords,
    isDeliverableForSelectedBranch,
    orderType,
    selectedAddress,
    selectedBranchId,
    selectedBranchNameForUi,
  ]);

  return {
    hasSelectedAddressCoords,
    isDeliverableForSelectedBranch,
    deliveryDisabled,
    deliveryInfoText,
    deliveryValidationData,
  };
}
