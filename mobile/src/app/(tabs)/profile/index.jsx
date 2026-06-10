import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../utils/theme";
import { useAuth } from "../../../utils/auth/useAuth";
import useUser from "../../../utils/auth/useUser";
import { useBranchStore } from "../../../utils/branchStore";
import { useProfileData } from "../../../hooks/useProfileData";
import UnauthenticatedView from "../../../components/Profile/UnauthenticatedView";
import AuthenticatedView from "../../../components/Profile/AuthenticatedView";
import { SlideMenu } from "../../../components/Home/SlideMenu";
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
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, statusBarStyle } = useTheme();
  const { isAuthenticated, isReady, signIn, signOut } = useAuth();
  const { data: user, loading: userLoading } = useUser();
  const { selectedBranch, setSelectedBranch, clearBranch } = useBranchStore();
  const [menuVisible, setMenuVisible] = useState(false);

  // Fetch full profile data
  const { data: profileData } = useProfileData(isAuthenticated);

  const [loaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!loaded) {
    return null;
  }

  const handleChangeLocation = async (cartData) => {
    setSelectedBranch(null);
    router.push("/select-branch");
  };

  const handleSignIn = async () => {
    await Haptics.selectionAsync();
    signIn();
  };

  const handleSignOut = async () => {
    console.log("[PROFILE] ========== SIGNING OUT ==========");

    // Sign out from auth system (this clears all auth storage)
    await signOut();

    // Clear branch selection
    await clearBranch();
    console.log("[PROFILE] Branch selection cleared");

    // Clear all query caches to prevent showing old data
    queryClient.clear();
    console.log("[PROFILE] Query cache cleared");

    console.log("[PROFILE] ========== SIGNOUT COMPLETE ==========");

    // Haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Navigate to branch selection
    router.replace("/select-branch");
  };

  if (!isReady || userLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SlideMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          colors={colors}
          selectedBranch={selectedBranch}
          onChangeLocation={() => handleChangeLocation(null)}
        />
        <UnauthenticatedView
          colors={colors}
          statusBarStyle={statusBarStyle}
          insets={insets}
          onSignIn={handleSignIn}
          onMenuPress={() => setMenuVisible(true)}
        />
      </>
    );
  }

  // User is authenticated (regular customer)
  const fullProfile = profileData?.user || user;
  const addresses = profileData?.addresses;

  return (
    <>
      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={() => handleChangeLocation(null)}
      />
      <AuthenticatedView
        user={fullProfile}
        addresses={addresses}
        colors={colors}
        statusBarStyle={statusBarStyle}
        insets={insets}
        onSignOut={handleSignOut}
        onMenuPress={() => setMenuVisible(true)}
      />
    </>
  );
}
