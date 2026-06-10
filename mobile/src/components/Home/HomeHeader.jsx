import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Image } from "expo-image";
import { Menu, ShoppingCart } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { getImageSource } from "@/utils/apiFetch";

export function HomeHeader({
  colors,
  insets,
  logoData,
  onMenuPress,
  cartItemCount,
  selectedBranch,
  onBranchPress,
}) {
  const router = useRouter();
  const [logoSrcOverride, setLogoSrcOverride] = useState(null);

  const withVersionParam = (url, updatedAt) => {
    if (!url) {
      return null;
    }

    // IMPORTANT: Only add a cache-busting param when we have a stable updatedAt.
    // If we use Date.now() here, the URL changes on every render and the logo
    // re-downloads constantly (looks like the home screen is "blinking").
    if (!updatedAt) {
      return url;
    }

    const version = new Date(updatedAt).getTime();
    const joinChar = url.includes("?") ? "&" : "?";
    return `${url}${joinChar}v=${encodeURIComponent(String(version))}`;
  };

  const preferredLogoUrl = useMemo(() => {
    if (!logoData) {
      return null;
    }

    const isNative = Platform.OS !== "web";
    const rawVersioned = withVersionParam(logoData.rawUrl, logoData.updatedAt);
    const urlVersioned = withVersionParam(logoData.url, logoData.updatedAt);

    if (isNative && rawVersioned) {
      return rawVersioned;
    }

    return urlVersioned || rawVersioned || null;
  }, [logoData]);

  const logoUrlToRender = logoSrcOverride || preferredLogoUrl;
  const logoSource = logoUrlToRender ? getImageSource(logoUrlToRender) : null;

  const handleLogoError = () => {
    if (logoSrcOverride) {
      return;
    }

    // Fallback to the other candidate once.
    const fallback = withVersionParam(logoData?.url, logoData?.updatedAt);
    if (fallback) {
      setLogoSrcOverride(fallback);
    }
  };

  const handleCartPress = () => {
    // don't block navigation on haptics
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push("/(tabs)/cart");
  };

  const handleBranchPress = () => {
    if (!onBranchPress) {
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }

    onBranchPress();
  };

  const branchName = selectedBranch?.name || null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      <View
        style={{
          position: "relative",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingVertical: 16,
        }}
      >
        {/* Left: Hamburger Menu */}
        <TouchableOpacity
          onPress={onMenuPress}
          style={{
            padding: 8,
          }}
        >
          <Menu size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Center: Logo (always centered) */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {logoSource?.uri ? (
            <Image
              source={logoSource}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
              }}
              contentFit="contain"
              transition={200}
              onError={handleLogoError}
            />
          ) : null}
        </View>

        {/* Right: Branch name (clickable) + Cart */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          {branchName ? (
            <TouchableOpacity
              onPress={handleBranchPress}
              activeOpacity={0.8}
              style={{
                // Give the branch chip a bit more room so names like "Bd Naccache" don't truncate.
                maxWidth: 190,
                flexShrink: 1,
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 6,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: colors.separator,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  lineHeight: 12,
                  color: colors.text,
                  textAlign: "right",
                }}
                // Allow 2 lines + auto-shrink instead of showing "BD..."
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {branchName}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={handleCartPress}
            style={{
              padding: 8,
              position: "relative",
            }}
          >
            <ShoppingCart size={24} color={colors.text} />
            {cartItemCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  backgroundColor: colors.primary,
                  borderRadius: 10,
                  width: 18,
                  height: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 10,
                    color: "white",
                  }}
                >
                  {cartItemCount > 9 ? "9+" : cartItemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
