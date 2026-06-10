import { View, Text, TextInput, TouchableOpacity, Linking } from "react-native";
import { Calendar, CheckSquare, Square } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { formatBirthday } from "@/utils/dateHelpers";

export function ProfileStep({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  birthday,
  loading,
  onSignup,
  onShowDatePicker,
  consentGiven,
  setConsentGiven,
}) {
  const handleConsentToggle = async () => {
    await Haptics.selectionAsync();
    setConsentGiven(!consentGiven);
  };

  const openPrivacyPolicy = async () => {
    await Haptics.selectionAsync();
    // IMPORTANT: Replace with your actual privacy policy URL
    // Your privacy policy MUST clearly explain:
    // - Collection of phone numbers, names, birthdays
    // - Collection and sharing of location data with Google Maps API
    // - Sharing of delivery addresses with your delivery team
    // - How users can request data deletion
    // - Third-party data processors and their privacy practices
    const url = "https://www.neobeirut.com/privacy";
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  const openTermsOfService = async () => {
    await Haptics.selectionAsync();
    // IMPORTANT: Replace with your actual terms of service URL
    const url = "https://www.neobeirut.com/terms";
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#374151",
              marginBottom: 8,
            }}
          >
            First Name *
          </Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="John"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              backgroundColor: "#fff",
            }}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Last Name *
          </Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Doe"
            placeholderTextColor="#9CA3AF"
            style={{
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

      <View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#374151",
            marginBottom: 8,
          }}
        >
          Birthday * (Must be 13+)
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await Haptics.selectionAsync();
            onShowDatePicker();
          }}
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            padding: 16,
            backgroundColor: "#fff",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: birthday ? "#1F2937" : "#9CA3AF",
            }}
          >
            {birthday ? formatBirthday(birthday) : "Select your birthday"}
          </Text>
          <Calendar size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Data Collection Consent */}
      <TouchableOpacity
        onPress={handleConsentToggle}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          paddingVertical: 12,
        }}
      >
        {consentGiven ? (
          <CheckSquare size={24} color="#357AFF" />
        ) : (
          <Square size={24} color="#9CA3AF" />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              color: "#374151",
              lineHeight: 20,
            }}
          >
            I consent to the collection and use of my personal data (name, phone
            number, birthday, delivery addresses, location data, and order
            history) as described in the{" "}
            <Text
              onPress={openPrivacyPolicy}
              style={{
                color: "#357AFF",
                textDecorationLine: "underline",
              }}
            >
              Privacy Policy
            </Text>
            , including sharing location data with Google Maps API for address
            lookup and delivery services.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSignup}
        disabled={loading || !consentGiven}
        style={{
          backgroundColor: loading || !consentGiven ? "#9CA3AF" : "#357AFF",
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </Text>
      </TouchableOpacity>

      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          By signing up, you agree to our
        </Text>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
          <TouchableOpacity onPress={openTermsOfService}>
            <Text
              style={{
                fontSize: 12,
                color: "#357AFF",
                textDecorationLine: "underline",
              }}
            >
              Terms of Service
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>and</Text>
          <TouchableOpacity onPress={openPrivacyPolicy}>
            <Text
              style={{
                fontSize: 12,
                color: "#357AFF",
                textDecorationLine: "underline",
              }}
            >
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
