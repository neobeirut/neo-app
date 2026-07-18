import { useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";

export function useRewardsData(
  isAuthenticated,
  paramsOrAuth,
  setSelectedReward,
  setSelectedUserReward,
) {
  // Determine which mode we're in based on number of arguments
  const isCheckoutMode = arguments.length === 4;
  const params = isCheckoutMode ? paramsOrAuth : null;

  const {
    data: loyaltyData,
    isLoading: loyaltyLoading,
    error: loyaltyError,
    refetch: refetchLoyalty,
  } = useQuery({
    queryKey: ["loyalty"],
    queryFn: async () => {
      const response = await apiFetch("/api/loyalty/points");
      if (!response.ok) {
        throw new Error("Failed to fetch loyalty data");
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const {
    data: rewardsData,
    isLoading: rewardsLoading,
    error: rewardsError,
    refetch: refetchRewards,
  } = useQuery({
    queryKey: ["rewards"],
    queryFn: async () => {
      const response = await apiFetch("/api/rewards");
      if (!response.ok) {
        throw new Error("Failed to fetch rewards");
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const isLoading = loyaltyLoading || rewardsLoading;

  // Checkout mode: process and filter data
  const currentPoints = loyaltyData?.currentPoints || 0;
  const rewards = Array.isArray(rewardsData?.rewards)
    ? rewardsData.rewards
    : [];

  const availableUserRewards = Array.isArray(
    loyaltyData?.userRewards?.available,
  )
    ? loyaltyData.userRewards.available
    : [];

  const eligibleRewards = useMemo(() => {
    return rewards
      .filter((r) => r && r.is_active !== false)
      .filter((r) => currentPoints >= Number(r.points_cost || 0))
      .sort((a, b) => Number(a.points_cost || 0) - Number(b.points_cost || 0));
  }, [rewards, currentPoints]);

  const eligibleUserRewards = useMemo(() => {
    return availableUserRewards
      .filter((ur) => ur && ur.status === "available")
      .filter((ur) => {
        if (!ur.expires_at) return true;
        return new Date(ur.expires_at) >= new Date();
      });
  }, [availableUserRewards]);

  const combinedRewardOptions = useMemo(() => {
    const perks = eligibleUserRewards.map((ur) => ({
      kind: "user",
      id: ur.id,
      title: ur.title,
      description: ur.description,
      expires_at: ur.expires_at,
      source: ur.source,
    }));

    const points = eligibleRewards.map((r) => ({
      kind: "points",
      id: r.id,
      title: r.title,
      points_cost: r.points_cost,
      discount_amount: r.discount_amount,
      free_delivery: r.free_delivery,
    }));

    return [...perks, ...points];
  }, [eligibleUserRewards, eligibleRewards]);

  const applyRewardFromParamsIfPossible = useCallback(() => {
    if (!isCheckoutMode) return;

    const applyRewardIdRaw = params?.applyRewardId;
    const applyUserRewardIdRaw = params?.applyUserRewardId;

    if (applyUserRewardIdRaw) {
      const id = String(applyUserRewardIdRaw);
      const found = eligibleUserRewards.find((ur) => String(ur.id) === id);
      if (found) {
        setSelectedUserReward?.(found);
        setSelectedReward?.(null);
      }
      return;
    }

    if (!applyRewardIdRaw) return;

    const applyRewardId = Number.parseInt(String(applyRewardIdRaw), 10);
    if (!Number.isFinite(applyRewardId)) return;

    const found = eligibleRewards.find((r) => Number(r.id) === applyRewardId);
    if (found) {
      setSelectedReward?.(found);
      setSelectedUserReward?.(null);
    }
  }, [
    isCheckoutMode,
    eligibleRewards,
    eligibleUserRewards,
    params,
    setSelectedReward,
    setSelectedUserReward,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isCheckoutMode) {
      return;
    }
    applyRewardFromParamsIfPossible();
  }, [applyRewardFromParamsIfPossible, isAuthenticated, isCheckoutMode]);

  // Return different data based on mode
  if (!isCheckoutMode) {
    return {
      loyaltyData,
      rewardsData: rewardsData || { rewards: [] },
      isLoading,
      loyaltyError,
      rewardsError,
      refetchLoyalty,
      refetchRewards,
    };
  }

  return {
    currentPoints,
    eligibleRewards,
    eligibleUserRewards,
    combinedRewardOptions,
  };
}
