import React, { useState, useRef, useEffect } from "react";
import { View, Text, Animated, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "../../../utils/theme";
import { useBranchStore } from "../../../utils/branchStore";
import { useAuth } from "../../../utils/auth/useAuth";
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
import { useMenuData } from "../../../hooks/useMenuData";
import { MenuHeader } from "../../../components/Menu/MenuHeader";
import { LoadingState } from "../../../components/Menu/LoadingState";
import { SlideMenu } from "../../../components/Home/SlideMenu";
import { getImageSource } from "../../../utils/apiFetch";

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { isAuthenticated, isReady } = useAuth();
  const [selectedSection, setSelectedSection] = useState("Store");
  const [menuVisible, setMenuVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Redirect to home if no branch is selected
  useEffect(() => {
    if (!selectedBranch) {
      router.replace("/(tabs)/home");
    }
  }, [selectedBranch]);

  // Fetch data
  const { categoriesData, categoriesLoading, cartData } = useMenuData(
    selectedBranch,
    isAuthenticated,
    isReady,
  );

  if (!loaded || categoriesLoading || !selectedBranch) {
    return <LoadingState colors={colors} statusBarStyle={statusBarStyle} />;
  }

  const headerHeight = 280;

  const categories = categoriesData?.categories || [];
  const groupedCategories = categoriesData?.groupedCategories || {};

  // Get categories for the selected section
  const sectionCategories = groupedCategories[selectedSection] || [];

  const handleCategoryPress = async (category) => {
    await Haptics.selectionAsync();
    router.push({
      pathname: "/(tabs)/menu/category-products",
      params: {
        categoryId: category.id,
        categoryName: category.name,
        section: selectedSection,
      },
    });
  };

  const handleSectionChange = (section) => {
    setSelectedSection(section);
  };

  const handleChangeLocation = () => {
    if (cartData?.cart_items?.length > 0) {
      // Show warning about cart clearing
      router.push("/select-branch");
    } else {
      router.push("/select-branch");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={() => handleChangeLocation()}
      />

      <MenuHeader
        colors={colors}
        insets={insets}
        scrollY={scrollY}
        selectedBranch={selectedBranch}
        selectedSection={selectedSection}
        setSelectedSection={handleSectionChange}
        searchQuery=""
        setSearchQuery={() => {}}
        selectedCategory="all"
        groupedCategories={groupedCategories}
        onChangeLocation={() => handleChangeLocation()}
        onCategoryPress={() => {}}
        onMenuPress={() => setMenuVisible(true)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight,
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
        {/* Category List */}
        {sectionCategories.length > 0 ? (
          sectionCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              onPress={() => handleCategoryPress(category)}
              style={{
                flexDirection: "row",
                backgroundColor: colors.surface,
                borderRadius: 16,
                marginBottom: 16,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              {category.image_url && (
                <View style={{ position: "relative", width: 120, height: 120 }}>
                  <Image
                    source={getImageSource(category.image_url)}
                    style={{
                      width: 120,
                      height: 120,
                      backgroundColor: colors.separator,
                    }}
                    contentFit="cover"
                  />
                  {/* Gradient overlay for better text visibility */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.25)",
                    }}
                  />
                </View>
              )}
              <View
                style={{
                  flex: 1,
                  padding: 16,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "PlayfairDisplay_800ExtraBold",
                    fontSize: 30,
                    color: colors.text,
                    marginBottom: 4,
                    textShadowColor: "rgba(0, 0, 0, 0.75)",
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 4,
                  }}
                >
                  {category.name}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: colors.primary,
                      marginRight: 4,
                    }}
                  >
                    View Items
                  </Text>
                  <ChevronRight size={16} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              No categories available in this section
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
