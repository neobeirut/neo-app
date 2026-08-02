import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ChevronDown } from "lucide-react-native";
import { useAuth } from "../utils/auth/useAuth";
import { useAuthModal } from "../utils/auth/store";
import { useBranchStore } from "../utils/branchStore";
import KeyboardAvoidingAnimatedView from "../components/KeyboardAvoidingAnimatedView";
import { phoneAuth } from "../utils/auth/phoneAuth";
import { apiFetch } from "../utils/apiFetch";

// Common country codes
const COUNTRY_CODES = [
  { code: "+961", country: "Lebanon", flag: "🇱🇧" },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+20", country: "Egypt", flag: "🇪🇬" },
  { code: "+962", country: "Jordan", flag: "🇯🇴" },
  { code: "+90", country: "Turkey", flag: "🇹🇷" },
];

export default function SigninScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuth();
  const { isOpen: isModalOpen, open: openAuthModal } = useAuthModal();
  const { selectedBranch } = useBranchStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Phone, 2: Verification

  // Step 1: Phone
  const [countryCode, setCountryCode] = useState("+961");
  const [phone, setPhone] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Step 2: Verification
  const [verificationCode, setVerificationCode] = useState("");
  const [debugCode, setDebugCode] = useState(null);

  const safeHaptics = {
    selection: async () => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.selectionAsync();
      } catch (e) {
        // ignore
      }
    },
    notify: async (type) => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.notificationAsync(type);
      } catch (e) {
        // ignore
      }
    },
  };

  const handleSendCode = async () => {
    if (!phone) {
      Alert.alert("Error", "Please enter your phone number");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const fullPhone = `${countryCode} ${phone}`;
    setLoading(true);
    try {
      // First, check if phone number exists
      const checkResponse = await apiFetch("/api/auth/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const checkData = await checkResponse.json().catch(() => ({}));

      // Check if account is deleted/inactive
      if (
        !checkResponse.ok &&
        checkData.error === "This account has been deleted"
      ) {
        setLoading(false);
        Alert.alert(
          "Account Deleted",
          "This account has been deleted and cannot be used to sign in. Please contact support or create a new account with a different phone number.",
          [
            {
              text: "OK",
              style: "cancel",
              onPress: async () => {
                await safeHaptics.notify(
                  Haptics.NotificationFeedbackType.Error,
                );
              },
            },
          ],
        );
        return;
      }

      if (!checkResponse.ok || !checkData.exists) {
        // Phone number doesn't exist
        setLoading(false);
        Alert.alert(
          "Account Not Found",
          "This phone number doesn't have an account yet. Would you like to create one?",
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: async () => {
                await safeHaptics.notify(
                  Haptics.NotificationFeedbackType.Warning,
                );
              },
            },
            {
              text: "Sign Up",
              onPress: () => {
                // If we're in the modal, switch mode; otherwise navigate
                if (isModalOpen) {
                  openAuthModal({ mode: "signup" });
                } else {
                  router.replace("/signup");
                }
              },
            },
          ],
        );
        return;
      }

      // Phone number exists, send verification code
      const response = await apiFetch("/api/auth/phone-send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // WhatsApp-only OTP
        body: JSON.stringify({ phone: fullPhone, channel: "whatsapp" }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Important: surface backend diagnostics so we can see WHICH secret is missing.
        console.error("/api/auth/phone-send-code failed", {
          status: response.status,
          statusText: response.statusText,
          data,
        });

        const diagnosticsText = data?.diagnostics
          ? `\n\nDiagnostics: ${JSON.stringify(data.diagnostics)}`
          : "";

        throw new Error(
          `${data?.error || "Failed to send code"}${diagnosticsText}`,
        );
      }

      await safeHaptics.notify(Haptics.NotificationFeedbackType.Success);
      setStep(2);

      // In development/web preview only, show the code for testing.
      // NEVER show verification codes on native platforms (App Store compliance).
      if (data.code && Platform.OS === "web") {
        setDebugCode(String(data.code));
      } else {
        setDebugCode(null);
        Alert.alert(
          "Code Sent",
          "We sent you a verification code on WhatsApp.",
        );
      }
    } catch (error) {
      console.error("Error sending code:", error);
      Alert.alert("Error", error.message || "Failed to send verification code");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const fullPhone = `${countryCode} ${phone}`;
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/phone-verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code: verificationCode }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Invalid code");
      }

      // Store phone auth in the system that useAuth actually reads (phoneAuth -> SecureStore)
      const user = await phoneAuth.verifyPhone(fullPhone);
      if (!user) {
        throw new Error("Could not load your profile after verification");
      }

      // Use canonical phone returned by backend when available.
      const canonicalPhone = user?.phone || fullPhone;

      // Update the auth store
      setAuth({
        user,
        phone: canonicalPhone,
      });

      await safeHaptics.notify(Haptics.NotificationFeedbackType.Success);

      // If sign-in is happening inside the auth modal, don't navigate away.
      if (isModalOpen) {
        return;
      }

      // Standalone /signin screen fallback
      if (selectedBranch?.id || user.branch_id) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/select-branch");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      Alert.alert("Error", error.message || "Invalid verification code");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginBottom: 32,
        justifyContent: "center",
      }}
    >
      {[1, 2].map((s) => (
        <View
          key={s}
          style={{
            width: step >= s ? 40 : 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: step >= s ? "#357AFF" : "#E5E7EB",
          }}
        />
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior="padding"
    >
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <StatusBar style="dark" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              fontSize: 32,
              fontWeight: "bold",
              color: "#1F2937",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {step === 1 ? "Welcome Back!" : "Verify Phone"}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#6B7280",
              marginBottom: 40,
              textAlign: "center",
            }}
          >
            {step === 1
              ? "Enter your phone number to sign in"
              : "Enter the code we sent to your phone"}
          </Text>

          {renderStepIndicator()}

          {/* Step 1: Phone Number */}
          {step === 1 && (
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
                      await safeHaptics.selection();
                      setShowCountryPicker(true);
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
                      {COUNTRY_CODES.find((c) => c.code === countryCode)
                        ?.flag || "🌍"}
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
                onPress={handleSendCode}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#9CA3AF" : "#357AFF",
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </Text>
              </TouchableOpacity>

              <View style={{ marginTop: 20, alignItems: "center" }}>
                <Text style={{ color: "#6B7280", fontSize: 14 }}>
                  Don't have an account?{" "}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    // If we're in the modal, switch mode; otherwise navigate
                    if (isModalOpen) {
                      openAuthModal({ mode: "signup" });
                    } else {
                      router.replace("/signup");
                    }
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text
                    style={{
                      color: "#357AFF",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Verification Code */}
          {step === 2 && (
            <View style={{ gap: 20 }}>
              {debugCode ? (
                <View
                  style={{
                    backgroundColor: "#EFF6FF",
                    borderColor: "#BFDBFE",
                    borderWidth: 1,
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#1F2937",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    Test code (preview only)
                  </Text>
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 22,
                      fontWeight: "700",
                      letterSpacing: 6,
                      color: "#1D4ED8",
                      textAlign: "center",
                    }}
                  >
                    {debugCode}
                  </Text>
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#6B7280",
                      textAlign: "center",
                    }}
                  >
                    If you’re testing in preview and SMS isn’t available, use
                    this code.
                  </Text>
                </View>
              ) : null}

              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Verification Code *
                </Text>
                <TextInput
                  value={verificationCode}
                  onChangeText={(text) => {
                    // Guard against copy/paste spaces or non-ascii digits in web preview
                    const cleaned = String(text || "").replace(/\D/g, "");
                    setVerificationCode(cleaned);
                  }}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={{
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 24,
                    backgroundColor: "#fff",
                    textAlign: "center",
                    letterSpacing: 8,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6B7280",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Code sent to {countryCode} {phone}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleVerifyCode}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#9CA3AF" : "#357AFF",
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await safeHaptics.selection();
                  setStep(1);
                  setVerificationCode("");
                }}
                style={{ alignItems: "center", marginTop: 8 }}
              >
                <Text style={{ color: "#357AFF", fontSize: 14 }}>
                  Change Phone Number
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendCode}
                disabled={loading}
                style={{ alignItems: "center" }}
              >
                <Text style={{ color: "#357AFF", fontSize: 14 }}>
                  Resend Code
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Country Code Picker Modal */}
        <Modal
          visible={showCountryPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: insets.bottom + 20,
                maxHeight: "70%",
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: "600" }}>
                  Select Country Code
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    await safeHaptics.selection();
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={{ fontSize: 16, color: "#357AFF" }}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Country List */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {COUNTRY_CODES.map((country) => (
                  <TouchableOpacity
                    key={country.code}
                    onPress={async () => {
                      await safeHaptics.selection();
                      setCountryCode(country.code);
                      setShowCountryPicker(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      backgroundColor:
                        countryCode === country.code
                          ? "#EFF6FF"
                          : "transparent",
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{country.flag}</Text>
                      <View>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight:
                              countryCode === country.code ? "600" : "400",
                            color: "#1F2937",
                          }}
                        >
                          {country.country}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight:
                          countryCode === country.code ? "600" : "500",
                        color:
                          countryCode === country.code ? "#357AFF" : "#6B7280",
                      }}
                    >
                      {country.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
