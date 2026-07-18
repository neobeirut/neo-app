import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Mail, MessageCircle, Phone } from "lucide-react-native";
import { useTheme } from "../utils/theme";
import useUser from "../utils/auth/useUser";

export default function ContactSupport() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: user } = useUser();
  const [message, setMessage] = useState("");

  const supportEmail = "info@neobeirut.com";
  const supportPhone = "+9613361515"; // Replace with actual support number

  async function handleEmailSupport() {
    const subject = "Neo Beirut App Support Request";
    const body = `User: ${user?.email || "Guest"}\n\nMessage:\n${message}`;
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Email Not Available",
          `Please email us at ${supportEmail}`,
        );
      }
    } catch (e) {
      console.error("Error opening email:", e);
      Alert.alert("Error", "Failed to open email client");
    }
  }

  async function handleCallSupport() {
    const url = `tel:${supportPhone.replace(/\s/g, "")}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Phone Not Available", `Please call us at ${supportPhone}`);
      }
    } catch (e) {
      console.error("Error opening phone:", e);
      Alert.alert("Error", "Failed to open phone dialer");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 8 }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: colors.text,
            }}
          >
            Contact Support
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            color: colors.textSecondary,
            marginBottom: 24,
            lineHeight: 22,
          }}
        >
          Need help with the Neo Beirut app? We're here to assist you with any
          questions or issues you may have.
        </Text>

        {/* Contact Methods */}
        <View style={{ gap: 12, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={handleEmailSupport}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Mail size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 2,
                }}
              >
                Email Support
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.textSecondary,
                }}
              >
                {supportEmail}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCallSupport}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Phone size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 2,
                }}
              >
                Call Support
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.textSecondary,
                }}
              >
                {supportPhone}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Message Input */}
        <View>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            Describe Your Issue
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what you need help with..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: colors.text,
              minHeight: 120,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
          />
        </View>

        {/* Send Button */}
        <TouchableOpacity
          onPress={handleEmailSupport}
          disabled={!message.trim()}
          style={{
            backgroundColor: message.trim() ? colors.primary : colors.separator,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "#FFFFFF",
            }}
          >
            Send Email
          </Text>
        </TouchableOpacity>

        {/* FAQ Link */}
        <View
          style={{
            marginTop: 32,
            padding: 16,
            backgroundColor: colors.card,
            borderRadius: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MessageCircle size={20} color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: colors.text,
              }}
            >
              Common Questions
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.textSecondary,
              marginTop: 8,
              lineHeight: 18,
            }}
          >
            • How do I track my order?{"\n"}• How do I update my delivery
            address?{"\n"}• How does the loyalty program work?{"\n"}• How do I
            change my notification settings?
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
