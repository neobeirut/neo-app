import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../utils/theme";
import { useAuth } from "../../../utils/auth/useAuth";
import { useBranchStore } from "../../../utils/branchStore";
import {
  useFonts,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_800ExtraBold,
} from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { SlideMenu } from "../../../components/Home/SlideMenu";
import { UnauthenticatedView } from "../../../components/Rewards/UnauthenticatedView";
import { LoadingState } from "../../../components/Rewards/LoadingState";
import {
  RewardsHeader,
  headerHeight,
} from "../../../components/Rewards/RewardsHeader";
import { PointsCard } from "../../../components/Rewards/PointsCard";
import { UserRewardCard } from "../../../components/Rewards/UserRewardCard";
import { UserRewardHistoryItem } from "../../../components/Rewards/UserRewardHistoryItem";
import { RewardCard } from "../../../components/Rewards/RewardCard";
import { ActivityItem } from "../../../components/Rewards/ActivityItem";
import { TierBenefitsCard } from "../../../components/Rewards/TierBenefitsCard";
import { HowItWorksCard } from "../../../components/Rewards/HowItWorksCard";
import { TierUpgradeModal } from "../../../components/Rewards/TierUpgradeModal";
import { HowItWorksModal } from "../../../components/Rewards/HowItWorksModal";
import { useRewardsData } from "../../../hooks/useRewardsData";
import { useTierUpgrade } from "../../../hooks/useTierUpgrade";
import {
  formatMoney,
  useTierBadgeColor,
  useTierBenefits,
  formatActivityItem,
} from "../../../utils/rewardsHelpers";

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { isAuthenticated, signIn, auth } = useAuth();
  const { selectedBranch } = useBranchStore();
  const [menuVisible, setMenuVisible] = useState(false);

  // How-it-works overlay (auto-opens until user selects "Do not show again")
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const didInitHowItWorks = useRef(false);

  const [loaded, fontError] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const safeHapticsSelection = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync().catch(() => {});
  };

  // Move these handlers up so they work even when the user is not signed in
  const handleMenuPress = () => {
    safeHapticsSelection();
    setMenuVisible(true);
  };

  const handleChangeLocation = () => {
    safeHapticsSelection();

    // IMPORTANT: do NOT clear selectedBranch before navigating.
    // Clearing it makes Home briefly show an empty state ("No categories available").
    // Use push so the first tap reliably navigates in nested navigators.
    router.push("/select-branch");
  };

  const openHowItWorks = useCallback(() => {
    safeHapticsSelection();
    setHowItWorksVisible(true);
  }, []);

  const {
    loyaltyData,
    rewardsData,
    isLoading,
    loyaltyError,
    rewardsError,
    refetchLoyalty,
    refetchRewards,
  } = useRewardsData(isAuthenticated, auth);

  const currentPoints = loyaltyData?.currentPoints || 0;
  const membershipTier = loyaltyData?.membershipTier || "Bronze";
  const recentActivity = loyaltyData?.recentActivity || [];
  const totalSpent = Number(loyaltyData?.totalSpent || 0);
  const tierProgress = loyaltyData?.tierProgress || null;
  const availableUserRewards = loyaltyData?.userRewards?.available || [];
  const userRewardsHistory = loyaltyData?.userRewards?.history || [];
  const tierUpgradePopup = loyaltyData?.tierUpgradePopup || null;
  const rewards = rewardsData.rewards || [];

  const howItWorksDismissed = !!loyaltyData?.howItWorksDismissed;

  useEffect(() => {
    if (didInitHowItWorks.current) return;
    if (!loyaltyData) return;

    didInitHowItWorks.current = true;

    if (!howItWorksDismissed) {
      setHowItWorksVisible(true);
    }
  }, [loyaltyData, howItWorksDismissed]);

  const tierBadgeColor = useTierBadgeColor(membershipTier);
  const tierBenefits = useTierBenefits(membershipTier);

  const { tierPopupVisible, handleTierPopupAction } =
    useTierUpgrade(tierUpgradePopup);

  if (!loaded && !fontError) {
    return <LoadingState colors={colors} statusBarStyle={statusBarStyle} />;
  }

  if (fontError) {
    console.error("[Rewards] Font load error:", fontError);
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />

        {/* Allow guests to open the modal too */}
        <HowItWorksModal
          visible={howItWorksVisible}
          colors={colors}
          auth={auth}
          onClose={() => setHowItWorksVisible(false)}
        />

        <SlideMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          colors={colors}
          selectedBranch={selectedBranch}
          onChangeLocation={handleChangeLocation}
        />

        <RewardsHeader
          insets={insets}
          colors={colors}
          scrollY={scrollY}
          onMenuPress={handleMenuPress}
          onHowItWorksPress={openHowItWorks}
        />

        <View
          style={{
            flex: 1,
            paddingTop: insets.top + headerHeight + 16,
          }}
        >
          <UnauthenticatedView colors={colors} signIn={signIn} />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return <LoadingState colors={colors} statusBarStyle={statusBarStyle} />;
  }

  if (loyaltyError || rewardsError) {
    const message = loyaltyError
      ? String(loyaltyError?.message || loyaltyError)
      : String(rewardsError?.message || rewardsError);

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <StatusBar style={statusBarStyle} />
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 22,
            color: colors.text,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          Couldn’t load rewards
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          {message}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 18,
          }}
          onPress={async () => {
            await Haptics.selectionAsync();
            refetchLoyalty();
            refetchRewards();
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "white",
            }}
          >
            Try again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextTierLabel = tierProgress?.nextTier || null;
  const tierProgressPct = tierProgress
    ? Number(tierProgress.progressPct || 0)
    : 0;
  const tierRemaining = tierProgress
    ? Number(tierProgress.remainingToNext || 0)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      <HowItWorksModal
        visible={howItWorksVisible}
        colors={colors}
        auth={auth}
        onClose={() => setHowItWorksVisible(false)}
        onSaved={() => {
          refetchLoyalty();
        }}
      />

      <TierUpgradeModal
        visible={tierPopupVisible}
        tierUpgradePopup={tierUpgradePopup}
        tierBadgeColor={tierBadgeColor}
        colors={colors}
        onAction={handleTierPopupAction}
      />

      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={handleChangeLocation}
      />

      <RewardsHeader
        insets={insets}
        colors={colors}
        scrollY={scrollY}
        onMenuPress={handleMenuPress}
        onHowItWorksPress={openHowItWorks}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 16,
          paddingHorizontal: 24,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        <PointsCard
          currentPoints={currentPoints}
          totalSpent={totalSpent}
          membershipTier={membershipTier}
          tierBadgeColor={tierBadgeColor}
          tierProgress={tierProgress}
          nextTierLabel={nextTierLabel}
          tierProgressPct={tierProgressPct}
          tierRemaining={tierRemaining}
          colors={colors}
          formatMoney={formatMoney}
        />

        {/* Available Perks */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 24,
              color: colors.text,
              marginBottom: 16,
            }}
          >
            Available Rewards
          </Text>

          {availableUserRewards.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              {availableUserRewards.map((ur) => (
                <UserRewardCard key={ur.id} userReward={ur} colors={colors} />
              ))}
            </View>
          ) : (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 12,
              }}
            >
              No perks available right now.
            </Text>
          )}

          {/* Points Rewards (existing catalog) */}
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              currentPoints={currentPoints}
              colors={colors}
            />
          ))}
        </View>

        {/* Redeemed History */}
        {userRewardsHistory.length > 0 ? (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 24,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Redeemed History
            </Text>
            {userRewardsHistory.slice(0, 10).map((ur) => (
              <UserRewardHistoryItem
                key={`${ur.id}-${ur.status}`}
                userReward={ur}
                colors={colors}
              />
            ))}
          </View>
        ) : null}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 24,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Recent Activity
            </Text>
            {recentActivity.map((transaction) => (
              <ActivityItem
                key={transaction.id}
                item={formatActivityItem(transaction)}
                colors={colors}
              />
            ))}
          </View>
        )}

        <TierBenefitsCard tierBenefits={tierBenefits} colors={colors} />

        <HowItWorksCard colors={colors} />
      </ScrollView>
    </View>
  );
}
