import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
} from "react-native";
import { Search, Filter, MapPin, ArrowLeft, Menu } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export function MenuHeader({
  colors,
  insets,
  scrollY,
  selectedBranch,
  selectedSection,
  setSelectedSection,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  groupedCategories,
  onChangeLocation,
  onCategoryPress,
  onMenuPress,
}) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        borderBottomWidth: scrollY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
        borderBottomColor: colors.separator,
      }}
    >
      <View style={{ paddingHorizontal: 24, paddingBottom: 0 }}>
        {/* Menu Button */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={onMenuPress}
            style={{
              padding: 8,
              marginRight: 8,
            }}
          >
            <Menu size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Location Header */}
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 10,
              padding: 10,
            }}
            onPress={onChangeLocation}
          >
            <MapPin size={16} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 10,
                  color: colors.textSecondary,
                }}
              >
                Current Location
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: colors.text,
                }}
              >
                {selectedBranch.name}
              </Text>
            </View>
            <ArrowLeft size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Store/Bistro Tabs */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: 10,
            padding: 4,
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor:
                selectedSection === "Store" ? colors.primary : "transparent",
              borderRadius: 8,
              paddingVertical: 8,
              alignItems: "center",
            }}
            onPress={async () => {
              await Haptics.selectionAsync();
              setSelectedSection("Store");
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: selectedSection === "Store" ? "white" : colors.text,
              }}
            >
              La Boutique
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor:
                selectedSection === "Bistro" ? colors.primary : "transparent",
              borderRadius: 8,
              paddingVertical: 8,
              alignItems: "center",
            }}
            onPress={async () => {
              await Haptics.selectionAsync();
              setSelectedSection("Bistro");
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: selectedSection === "Bistro" ? "white" : colors.text,
              }}
            >
              La Carte
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 0,
            gap: 10,
          }}
        >
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={{
              flex: 1,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.text,
            }}
            placeholder="Search our bakery..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity>
            <Filter size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top separator line */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.separator,
          marginTop: 0,
        }}
      />

      {/* Category ScrollView with padding */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          {/* All Categories Button */}
          <TouchableOpacity
            style={{
              backgroundColor:
                selectedCategory === "all" ? colors.primary : colors.surface,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
            }}
            onPress={() => onCategoryPress({ id: "all" })}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: selectedCategory === "all" ? "white" : colors.text,
              }}
            >
              All
            </Text>
          </TouchableOpacity>

          {/* Categories for selected section */}
          {groupedCategories[selectedSection] &&
            groupedCategories[selectedSection].map((category) => (
              <TouchableOpacity
                key={`${selectedSection}-${category.id}`}
                style={{
                  backgroundColor:
                    selectedCategory === category.id
                      ? colors.primary
                      : colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: selectedCategory === category.id ? 0 : 1,
                  borderColor: colors.separator,
                }}
                onPress={() => onCategoryPress(category)}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color:
                      selectedCategory === category.id ? "white" : colors.text,
                  }}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      {/* Bottom separator line */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.separator,
        }}
      />
    </Animated.View>
  );
}
