import { View, Text, TextInput, TouchableOpacity } from "react-native";

export function VerificationStep({
  verificationCode,
  setVerificationCode,
  countryCode,
  phone,
  loading,
  onVerifyCode,
  onChangePhone,
  onResendCode,
  debugCode,
}) {
  return (
    <View style={{ gap: 20 }}>
      {/* Never show the OTP on-screen on device. If you want a preview-only code in the future,
          gate it behind Platform.OS === 'web' and a dedicated dev flag. */}

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
            const cleaned = String(text || "").replace(/\D/g, "");
            setVerificationCode(cleaned);
          }}
          placeholder="000000"
          placeholderTextColor="#9CA3AF"
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
        onPress={onVerifyCode}
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
          {loading ? "Verifying..." : "Verify Code"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onChangePhone}
        style={{ alignItems: "center", marginTop: 8 }}
      >
        <Text style={{ color: "#357AFF", fontSize: 14 }}>
          Change Phone Number
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onResendCode}
        disabled={loading}
        style={{ alignItems: "center" }}
      >
        <Text style={{ color: "#357AFF", fontSize: 14 }}>Resend Code</Text>
      </TouchableOpacity>
    </View>
  );
}
