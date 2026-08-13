import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Linking,
  Pressable,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import {
  X,
  Home,
  ShoppingBag,
  Gift,
  User,
  MapPin,
  Heart,
  Clock,
  Facebook,
  Instagram,
  CalendarDays,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { getImageSource, apiFetch } from "@/utils/apiFetch";
import { useQuery } from "@tanstack/react-query";

export function SlideMenu({
  visible,
  onClose,
  colors,
  selectedBranch,
  onChangeLocation,
  onHomePress,
  logoData,
}) {
  const router = useRouter();
  const slideAnim = React.useRef(new Animated.Value(-300)).current;

  // Fetch logo if not provided (shared cache key with Home)
  const logoQuery = useQuery({
    queryKey: ["logo"],
    queryFn: async () => {
      const response = await apiFetch("/api/logo");
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Failed to fetch logo (${response.status}) ${text}`);
      }
      return response.json();
    },
    enabled: !logoData,
    retry: Platform.OS === "web" ? 0 : 1,
  });

  const resolvedLogoData = logoData || logoQuery.data;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const menuItems = [
    { icon: Home, label: "Home", route: "/(tabs)/home" },
    { icon: User, label: "Profile", route: "/(tabs)/profile" },
    { icon: Gift, label: "Rewards", route: "/(tabs)/rewards" },
    { icon: CalendarDays, label: "Events", route: "/events" },
    { icon: Clock, label: "Order History", route: "/order-history" },
    { icon: Heart, label: "My Favorites", route: "/(tabs)/favorites" },
  ];

  const safeHapticsSelection = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync().catch(() => {});
  };

  const handleMenuPress = (route, label) => {
    safeHapticsSelection();
    onClose?.();

    // If Home is clicked, call onHomePress to go back to categories
    if (label === "Home" && onHomePress) {
      // Defer so the modal has time to close before navigation/state updates
      setTimeout(() => {
        onHomePress();
      }, 0);
      return;
    }

    if (route) {
      setTimeout(() => {
        router.push(route);
      }, 0);
    }
  };

  const handleLocationPress = () => {
    safeHapticsSelection();
    onClose?.();

    // Important: defer navigation until after the menu closes.
    // Without this, the first tap can get swallowed and you can land on an
    // intermediate screen state (e.g. Home showing "No categories available").
    setTimeout(() => {
      if (onChangeLocation) {
        onChangeLocation();
      } else {
        router.push("/select-branch");
      }
    }, 0);
  };

  const handleLocateUsPress = () => {
    safeHapticsSelection();
    onClose?.();
    setTimeout(() => {
      router.push("/locate-us");
    }, 0);
  };

  const handleSocialPress = (platform) => {
    safeHapticsSelection();
    const urls = {
      facebook: "https://www.facebook.com/neobeirut/",
      instagram: "https://www.instagram.com/neobeirut",
    };

    if (urls[platform]) {
      Linking.openURL(urls[platform]);
    }
  };

  const withVersionParam = (url, updatedAt) => {
    if (!url) {
      return null;
    }

    if (!updatedAt) {
      return url;
    }

    const version = new Date(updatedAt).getTime();
    const joinChar = url.includes("?") ? "&" : "?";
    return `${url}${joinChar}v=${encodeURIComponent(String(version))}`;
  };

  const preferredLogoUrl = React.useMemo(() => {
    if (!resolvedLogoData) {
      return null;
    }

    const isNative = Platform.OS !== "web";
    const rawVersioned = withVersionParam(
      resolvedLogoData.rawUrl,
      resolvedLogoData.updatedAt,
    );
    const urlVersioned = withVersionParam(
      resolvedLogoData.url,
      resolvedLogoData.updatedAt,
    );

    if (isNative && rawVersioned) {
      return rawVersioned;
    }

    return urlVersioned || rawVersioned || null;
  }, [resolvedLogoData]);

  const logoSource = preferredLogoUrl ? getImageSource(preferredLogoUrl) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop: tap anywhere outside the menu to close */}
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        />

        {/* Menu */}
        <Animated.View
          style={{
            width: 280,
            height: "100%",
            backgroundColor: colors.background,
            transform: [{ translateX: slideAnim }],
            shadowColor: "#000",
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingTop: 60,
              paddingHorizontal: 24,
              paddingBottom: 24,
              borderBottomWidth: 1,
              borderBottomColor: colors.separator,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                alignSelf: "flex-end",
                padding: 8,
              }}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>

            {logoSource?.uri ? (
              <View
                style={{
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <Image
                  source={logoSource}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                  }}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            ) : null}

            <Text
              style={{
                fontFamily: "PlayfairDisplay_800ExtraBold",
                fontSize: 24,
                color: colors.text,
                marginTop: 12,
              }}
            >
              Menu
            </Text>
          </View>

          {/* Menu Items */}
          <View style={{ flex: 1, paddingTop: 16 }}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleMenuPress(item.route, item.label)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  gap: 16,
                }}
              >
                <item.icon size={22} color={colors.primary} />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Separator */}
            <View
              style={{
                height: 1,
                backgroundColor: colors.separator,
                marginVertical: 16,
                marginHorizontal: 24,
              }}
            />

            {/* Current Location */}
            <TouchableOpacity
              onPress={handleLocationPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingVertical: 16,
                gap: 16,
              }}
            >
              <MapPin size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 2,
                  }}
                >
                  Current Location
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 15,
                    color: colors.text,
                  }}
                  numberOfLines={1}
                >
                  {selectedBranch?.name || "Select Branch"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Locate Us */}
            <TouchableOpacity
              onPress={handleLocateUsPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingVertical: 16,
                gap: 16,
              }}
            >
              <MapPin size={22} color={colors.primary} />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                Locate Us
              </Text>
            </TouchableOpacity>

            {/* Social Media Icons */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingVertical: 24,
                gap: 20,
                marginTop: "auto",
                marginBottom: 40,
              }}
            >
              <TouchableOpacity
                onPress={() => handleSocialPress("facebook")}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Facebook size={24} color="#1877F2" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSocialPress("instagram")}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Instagram size={24} color="#E4405F" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
