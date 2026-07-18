import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { ChevronDown } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COUNTRY_CODES } from "@/utils/signupConstants";
import { useAuthModal } from "@/utils/auth/store";
import { useRouter } from "expo-router";

export function PhoneNumberStep({
  countryCode,
  phone,
  setPhone,
  loading,
  onSendCode,
  onShowCountryPicker,
}) {
  const { isOpen: isModalOpen, open: openAuthModal } = useAuthModal();
  const router = useRouter();

  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#374151",
            marginBottom: 8,
          }}
        >
          Phone Number *
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {/* Country Code Selector */}
          <TouchableOpacity
            onPress={async () => {
              await Haptics.selectionAsync();
              onShowCountryPicker();
            }}
            style={{
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              padding: 16,
              backgroundColor: "#fff",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minWidth: 110,
            }}
          >
            <Text style={{ fontSize: 20 }}>
              {COUNTRY_CODES.find((c) => c.code === countryCode)?.flag || "🌍"}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: "#1F2937",
                fontWeight: "500",
              }}
            >
              {countryCode}
            </Text>
            <ChevronDown size={16} color="#6B7280" />
          </TouchableOpacity>

          {/* Phone Number Input */}
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="3 123 456"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              backgroundColor: "#fff",
            }}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={onSendCode}
        disabled={loading}
        style={{
          backgroundColor: loading ? "#9CA3AF" : "#357AFF",
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          {loading ? "Sending..." : "Send Verification Code"}
        </Text>
      </TouchableOpacity>

      <View style={{ marginTop: 20, alignItems: "center" }}>
        <Text style={{ color: "#6B7280", fontSize: 14 }}>
          Already have an account?{" "}
        </Text>
        <TouchableOpacity
          onPress={() => {
            // If we're in the modal, switch mode; otherwise navigate
            if (isModalOpen) {
              openAuthModal({ mode: "signin" });
            } else {
              router.replace("/signin");
            }
          }}
          style={{ marginTop: 8 }}
        >
          <Text style={{ color: "#357AFF", fontSize: 14, fontWeight: "600" }}>
            Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
