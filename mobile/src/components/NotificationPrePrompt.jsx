import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { X } from "lucide-react-native";

export default function NotificationPrePrompt({
  visible,
  colors,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  loading,
  onEnable,
  onNotNow,
  onClose,
}) {
  const safeTitle = useMemo(() => {
    return title || "Stay updated";
  }, [title]);

  const safeBody = useMemo(() => {
    return (
      body ||
      "Enable notifications to receive important order updates and delivery status. You can separately opt-in for promotional offers and new menu items in your profile settings."
    );
  }, [body]);

  const primaryText = useMemo(() => {
    return primaryLabel || "Enable notifications";
  }, [primaryLabel]);

  const secondaryText = useMemo(() => {
    return secondaryLabel || "Not now";
  }, [secondaryLabel]);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onNotNow}
    >
      {/* Overlay: do NOT dismiss on outside tap */}
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 16,
            backgroundColor: colors?.card || "#fff",
            borderWidth: 1,
            borderColor: colors?.separator || "#E5E7EB",
            padding: 18,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors?.text || "#111",
              }}
            >
              {safeTitle}
            </Text>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color={colors?.textSecondary || "#6B7280"} />
            </Pressable>
          </View>

          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors?.textSecondary || "#4B5563",
              lineHeight: 20,
            }}
          >
            {safeBody}
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={onEnable}
              disabled={!!loading}
              style={{
                backgroundColor: colors?.primary || "#111",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                alignItems: "center",
                opacity: loading ? 0.8 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : null}
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: "#FFFFFF",
                }}
              >
                {primaryText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onNotNow}
              disabled={!!loading}
              style={{
                backgroundColor: "transparent",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors?.separator || "#E5E7EB",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors?.text || "#111",
                }}
              >
                {secondaryText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
