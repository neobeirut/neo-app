import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignupFlow } from "../hooks/useSignupFlow";
import { StepIndicator } from "../components/Signup/StepIndicator";
import { PhoneNumberStep } from "../components/Signup/PhoneNumberStep";
import { VerificationStep } from "../components/Signup/VerificationStep";
import { ProfileStep } from "../components/Signup/ProfileStep";
import { CountryCodePicker } from "../components/Signup/CountryCodePicker";
import { BirthdayPicker } from "../components/Signup/BirthdayPicker";
import KeyboardAvoidingAnimatedView from "../components/KeyboardAvoidingAnimatedView";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const {
    loading,
    step,
    countryCode,
    setCountryCode,
    phone,
    setPhone,
    verificationCode,
    setVerificationCode,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    birthday,
    setBirthday,
    consentGiven,
    setConsentGiven,
    handleSendCode,
    handleVerifyCode,
    handleSignup,
    goBackToPhoneStep,
    debugCode,
  } = useSignupFlow();

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Welcome!";
      case 2:
        return "Verify Phone";
      case 3:
        return "Complete Profile";
      default:
        return "Welcome!";
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 1:
        return "Enter your phone number to get started";
      case 2:
        return "Enter the code we sent to your phone";
      case 3:
        return "Tell us a bit about yourself";
      default:
        return "Enter your phone number to get started";
    }
  };

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
            {getStepTitle()}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#6B7280",
              marginBottom: 40,
              textAlign: "center",
            }}
          >
            {getStepSubtitle()}
          </Text>

          <StepIndicator currentStep={step} />

          {step === 1 && (
            <PhoneNumberStep
              countryCode={countryCode}
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              onSendCode={handleSendCode}
              onShowCountryPicker={() => setShowCountryPicker(true)}
            />
          )}

          {step === 2 && (
            <VerificationStep
              verificationCode={verificationCode}
              setVerificationCode={setVerificationCode}
              countryCode={countryCode}
              phone={phone}
              loading={loading}
              onVerifyCode={handleVerifyCode}
              onChangePhone={goBackToPhoneStep}
              onResendCode={handleSendCode}
              debugCode={debugCode}
            />
          )}

          {step === 3 && (
            <ProfileStep
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              birthday={birthday}
              loading={loading}
              onSignup={handleSignup}
              onShowDatePicker={() => setShowDatePicker(true)}
              consentGiven={consentGiven}
              setConsentGiven={setConsentGiven}
            />
          )}
        </ScrollView>

        <CountryCodePicker
          visible={showCountryPicker}
          countryCode={countryCode}
          onSelect={setCountryCode}
          onClose={() => setShowCountryPicker(false)}
          insets={insets}
        />

        <BirthdayPicker
          visible={showDatePicker}
          onConfirm={setBirthday}
          onClose={() => setShowDatePicker(false)}
          insets={insets}
        />
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
