import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";

export function PromoCodeSection({
  isAuthenticated,
  promoCodeInput,
  setPromoCodeInput,
  promoError,
  setPromoError,
  appliedPromo,
  setAppliedPromo,
  promoValidateMutation,
  selectedBranch,
  onApplyPromo,
  colors,
}) {
  if (!isAuthenticated) return null;

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 20,
          color: colors.text,
          marginBottom: 12,
        }}
      >
        Promo Code
      </Text>

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.separator,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          Enter code
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
          }}
        >
          <TextInput
            value={promoCodeInput}
            onChangeText={(t) => {
              setPromoCodeInput(t);
              setPromoError(null);
            }}
            placeholder="WELCOME10"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.separator,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              fontFamily: "Inter_500Medium",
              fontSize: 15,
            }}
          />

          <TouchableOpacity
            disabled={
              promoValidateMutation.isPending ||
              !promoCodeInput.trim() ||
              !selectedBranch?.id
            }
            onPress={onApplyPromo}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              opacity:
                promoValidateMutation.isPending ||
                !promoCodeInput.trim() ||
                !selectedBranch?.id
                  ? 0.6
                  : 1,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: "white",
              }}
            >
              Apply
            </Text>
          </TouchableOpacity>
        </View>

        {appliedPromo ? (
          <View style={{ marginTop: 12 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: colors.success,
              }}
            >
              Applied: {appliedPromo.code}
            </Text>
            {appliedPromo.description ? (
              <Text
                style={{
                  marginTop: 6,
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.textSecondary,
                }}
              >
                {appliedPromo.description}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={async () => {
                await Haptics.selectionAsync();
                setAppliedPromo(null);
                setPromoError(null);
                setPromoCodeInput("");
              }}
              style={{ marginTop: 10, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors.error,
                }}
              >
                Remove promo
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {promoError ? (
          <Text
            style={{
              marginTop: 10,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: colors.error,
            }}
          >
            {promoError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
