import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";

export function TierUpgradeModal({
  visible,
  tierUpgradePopup,
  tierBadgeColor,
  colors,
  onAction,
}) {
  if (!tierUpgradePopup) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onAction("dismiss")}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onAction("dismiss")}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => null}
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => onAction("dismiss")}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surface,
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityLabel="Close"
          >
            <Text style={{ color: colors.text, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View
              style={{
                backgroundColor: tierBadgeColor.bg,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: tierBadgeColor.fg,
                }}
              >
                {tierUpgradePopup.tier} Member
              </Text>
            </View>

            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 22,
                color: colors.text,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {tierUpgradePopup.title}
            </Text>

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 15,
                color: colors.textSecondary,
                textAlign: "center",
                marginBottom: 16,
                lineHeight: 20,
              }}
            >
              {tierUpgradePopup.message}
            </Text>

            <TouchableOpacity
              onPress={() => onAction("claim")}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 18,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: "white",
                }}
              >
                Claim welcome reward
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
