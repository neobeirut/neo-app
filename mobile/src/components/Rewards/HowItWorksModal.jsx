import React, { useMemo, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { X, Check } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function HowItWorksModal({ visible, colors, auth, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [doNotShow, setDoNotShow] = useState(false);

  const phone = auth?.phone || auth?.user?.phone || null;
  const hasJwt = !!auth?.jwt;

  // Guest users can still open/close this modal, but can't persist "do not show again"
  // on the server since there's no auth/phone identity.
  const canPersistPreference = useMemo(() => {
    return Boolean(hasJwt || phone);
  }, [hasJwt, phone]);

  const saveUrl = useMemo(() => {
    if (!hasJwt && phone) {
      return `/api/loyalty/how-it-works?phone=${encodeURIComponent(phone)}`;
    }
    return "/api/loyalty/how-it-works";
  }, [hasJwt, phone]);

  const saveMutation = useMutation({
    mutationFn: async ({ doNotShow: next }) => {
      const response = await apiFetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doNotShow: next }),
      });
      if (!response.ok) {
        throw new Error(
          `Failed to save preference (${response.status} ${response.statusText})`,
        );
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyalty"] });
      if (onSaved) {
        onSaved();
      }
    },
  });

  const handleClose = useCallback(async () => {
    try {
      if (doNotShow && canPersistPreference) {
        await saveMutation.mutateAsync({ doNotShow: true });
      }
    } catch (e) {
      console.error("[HowItWorksModal] save error:", e);
      // Even if save fails, let the user close the modal.
    } finally {
      if (onClose) {
        onClose();
      }
    }
  }, [doNotShow, canPersistPreference, onClose, saveMutation]);

  const toggleDoNotShow = useCallback(() => {
    setDoNotShow((v) => !v);
  }, []);

  const isSaving = !!saveMutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: Math.max(insets.top, 12),
            paddingHorizontal: 18,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 20,
              color: colors.text,
              includeFontPadding: false,
            }}
          >
            How It Works
          </Text>

          <TouchableOpacity
            onPress={handleClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <X size={18} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>

        {/* Body */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 12) + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 22,
              color: colors.text,
              marginBottom: 12,
              includeFontPadding: false,
            }}
          >
            🎁 NÉO Rewards — How It Works
          </Text>

          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              lineHeight: 20,
              color: colors.text,
              marginBottom: 14,
              includeFontPadding: false,
            }}
          >
            Every time you enjoy NÉO, you earn rewards.
          </Text>

          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: colors.text,
              marginBottom: 8,
              includeFontPadding: false,
            }}
          >
            It’s simple:
          </Text>

          <Text style={bulletStyle(colors)}>- 💵 $1 spent = 1 point</Text>
          <Text style={bulletStyle(colors)}>
            - ✨ Points unlock rewards and higher membership levels
          </Text>
          <Text style={bulletStyle(colors, true)}>
            - 🎉 The more you visit, the more we treat you
          </Text>

          <Text style={sectionTitleStyle(colors)}>
            🌱 Your Membership Levels
          </Text>

          <Text style={subTitleStyle(colors)}>🟤 Bronze</Text>
          <Text style={paragraphStyle(colors)}>
            You start here automatically. Earn points, enjoy a birthday treat,
            and begin collecting rewards.
          </Text>

          <Text style={subTitleStyle(colors)}>🥈 Silver</Text>
          <Text style={paragraphStyle(colors)}>
            Reached as you collect more points. Enjoy faster rewards, free
            upgrades, special perks, and early access to selected events.
          </Text>

          <Text style={subTitleStyle(colors)}>💎 Platinum</Text>
          <Text style={paragraphStyle(colors)}>
            Our most loyal guests. Receive monthly treats, exclusive perks,
            priority access, and surprise rewards from our team.
          </Text>

          <Text style={sectionTitleStyle(colors)}>⭐ Using Your Points</Text>
          <Text style={bulletStyle(colors)}>
            - Points can be exchanged for free drinks, pastries, desserts, or
            special upgrades
          </Text>
          <Text style={bulletStyle(colors)}>
            - Rewards appear automatically in your account
          </Text>
          <Text style={bulletStyle(colors, true)}>
            - Simply apply them at checkout — no codes needed
          </Text>

          <Text style={sectionTitleStyle(colors)}>🎂 Extra Treats</Text>
          <Text style={bulletStyle(colors)}>
            - A birthday reward every year
          </Text>
          <Text style={bulletStyle(colors)}>
            - Special surprises for our Silver & Platinum members
          </Text>
          <Text style={bulletStyle(colors, true)}>
            - Occasional exclusive offers just for loyalty members
          </Text>

          <Text style={sectionTitleStyle(colors)}>❤️ Why We Do This</Text>
          <Text style={paragraphStyle(colors)}>
            Because loyalty should feel personal, not complicated. No cards. No
            coupons. No pressure. Just good food, good moments, and a little
            something extra — on us.
          </Text>

          {canPersistPreference ? (
            <Pressable
              onPress={toggleDoNotShow}
              style={{
                marginTop: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.separator,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.separator,
                  backgroundColor: doNotShow
                    ? colors.primary
                    : colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {doNotShow ? <Check size={14} color="white" /> : null}
              </View>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: colors.text,
                  includeFontPadding: false,
                }}
              >
                Do not show again
              </Text>
            </Pressable>
          ) : null}

          <TouchableOpacity
            onPress={handleClose}
            disabled={isSaving}
            style={{
              marginTop: 14,
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              opacity: isSaving ? 0.8 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: "white",
                includeFontPadding: false,
              }}
            >
              {isSaving ? "Saving…" : "Close"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function bulletStyle(colors, isLast) {
  return {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginBottom: isLast ? 14 : 6,
    includeFontPadding: false,
  };
}

function sectionTitleStyle(colors) {
  return {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
    marginTop: 10,
    marginBottom: 8,
    includeFontPadding: false,
  };
}

function subTitleStyle(colors) {
  return {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
    marginBottom: 4,
    includeFontPadding: false,
  };
}

function paragraphStyle(colors) {
  return {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 10,
    includeFontPadding: false,
  };
}
