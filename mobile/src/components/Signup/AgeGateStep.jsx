import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Shield } from "lucide-react-native";

export function AgeGateStep({ colors, onConfirm, loading }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
      <View style={{ alignItems: "center", marginBottom: 40 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.card,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Shield size={40} color={colors.primary} />
        </View>

        <Text
          style={{
            fontFamily: "PlayfairDisplay_700Bold",
            fontSize: 28,
            color: colors.text,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Age Confirmation
        </Text>

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            color: colors.textSecondary,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          To use Neo Beirut, you must be at least 13 years old.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => onConfirm(true)}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 18,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "#FFFFFF",
            }}
          >
            I am 13 years or older
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onConfirm(false)}
          disabled={loading}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 18,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.separator,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: colors.text,
            }}
          >
            I am under 13
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          marginTop: 32,
          padding: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.textSecondary,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          We ask this to comply with age requirements for online services. Your
          privacy is important to us.
        </Text>
      </View>
    </View>
  );
}
