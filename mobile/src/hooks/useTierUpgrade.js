import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/apiFetch";
import { useAuthStore } from "@/utils/auth/store";

export function useTierUpgrade(tierUpgradePopup) {
  const [tierPopupVisible, setTierPopupVisible] = useState(false);
  const [tierPopupHandled, setTierPopupHandled] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tierPopupHandled && tierUpgradePopup && !tierPopupVisible) {
      setTierPopupVisible(true);
    }
  }, [tierPopupHandled, tierUpgradePopup, tierPopupVisible]);

  const handleTierPopupAction = useCallback(
    async (action) => {
      try {
        await Haptics.selectionAsync();

        const auth = useAuthStore.getState().auth;
        const phone = auth?.phone || auth?.user?.phone || null;
        const hasJwt = !!auth?.jwt;

        const url =
          !hasJwt && phone
            ? `/api/loyalty/tier-upgrade?phone=${encodeURIComponent(phone)}`
            : "/api/loyalty/tier-upgrade";

        const response = await apiFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to update tier popup");
        }

        setTierPopupHandled(true);
        setTierPopupVisible(false);
        queryClient.invalidateQueries({ queryKey: ["loyalty"] });
      } catch (e) {
        console.error(e);
        Alert.alert("Error", e?.message || "Could not update tier reward");
      }
    },
    [queryClient],
  );

  return {
    tierPopupVisible,
    handleTierPopupAction,
  };
}
