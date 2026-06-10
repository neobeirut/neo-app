import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import {
  User,
  Star,
  Trophy,
  ShoppingBag,
  LogIn,
  Menu,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";

export default function UnauthenticatedView({
  colors,
  statusBarStyle,
  insets,
  onSignIn,
  onMenuPress,
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Header with Menu Button */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingHorizontal: 24,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <TouchableOpacity
          onPress={async () => {
            await Haptics.selectionAsync();
            onMenuPress();
          }}
          style={{
            padding: 8,
            alignSelf: "flex-start",
          }}
        >
          <Menu size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingHorizontal: 24,
          paddingBottom: 100,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: colors.surface,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <User size={48} color={colors.textSecondary} />
          </View>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 28,
              color: colors.text,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Welcome to néo beirut
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            Sign in to earn points, track orders, and unlock exclusive rewards
          </Text>
        </View>

        {/* Benefits Cards */}
        <View style={{ gap: 16, marginBottom: 32 }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Star size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                Earn Rewards
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.textSecondary,
                  lineHeight: 20,
                }}
              >
                Get 1 point for every $1 spent
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Trophy size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                Exclusive Perks
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.textSecondary,
                  lineHeight: 20,
                }}
              >
                Access special offers and early product launches
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primaryMuted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ShoppingBag size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                Order History
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.textSecondary,
                  lineHeight: 20,
                }}
              >
                Track your orders and reorder favorites
              </Text>
            </View>
          </View>
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
          }}
          onPress={onSignIn}
        >
          <LogIn size={24} color="white" />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: "white",
            }}
          >
            Sign In / Sign Up
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
