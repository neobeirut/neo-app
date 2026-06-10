import { useState } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/utils/auth/useAuth";
import { calculateAge, formatBirthdayForAPI } from "@/utils/dateHelpers";
import { useAuthModal } from "@/utils/auth/store";
import { apiFetch } from "@/utils/apiFetch";
import { phoneAuth } from "@/utils/auth/phoneAuth";

export function useSignupFlow() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { isOpen: isModalOpen } = useAuthModal();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1: Phone
  const [countryCode, setCountryCode] = useState("+961");
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  // Step 2: Verification
  const [verificationCode, setVerificationCode] = useState("");

  // Step 3: Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const safeHaptics = {
    notify: async (type) => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.notificationAsync(type);
      } catch (e) {
        // ignore
      }
    },
    selection: async () => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.selectionAsync();
      } catch (e) {
        // ignore
      }
    },
  };

  // WhatsApp-only OTP
  const preferredOtpChannel = "whatsapp";

  const handleSendCode = async () => {
    if (!phone) {
      Alert.alert("Error", "Please enter your phone number");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const fullPhone = `${countryCode} ${phone}`;
    setLoading(true);
    try {
      // First, check if phone number already exists
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
          "This phone number is associated with a deleted account. Please contact support or use a different phone number to create a new account.",
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

      if (checkResponse.ok && checkData.exists) {
        // Phone number already has an account
        setLoading(false);
        Alert.alert(
          "Account Already Exists",
          "This phone number already has an account. Would you like to send a verification code to sign in?",
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
              text: "Send Code",
              onPress: async () => {
                // Send verification code and sign in
                setLoading(true);
                try {
                  const response = await apiFetch("/api/auth/phone-send-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      phone: fullPhone,
                      channel: preferredOtpChannel,
                    }),
                  });

                  const data = await response.json().catch(() => ({}));

                  if (!response.ok) {
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

                  await safeHaptics.notify(
                    Haptics.NotificationFeedbackType.Success,
                  );

                  const canonicalPhone = checkData?.user?.phone || fullPhone;

                  // Keep legacy storage (some screens still read AsyncStorage)
                  await AsyncStorage.setItem("userPhone", canonicalPhone);
                  await AsyncStorage.setItem(
                    "userData",
                    JSON.stringify(checkData.user),
                  );

                  // ALSO store to SecureStore via phoneAuth so useAuth can pick it up on app start
                  await phoneAuth.verifyPhone(canonicalPhone);

                  setAuth({
                    user: checkData.user,
                    phone: canonicalPhone,
                  });

                  if (!isModalOpen) {
                    router.replace("/select-branch");
                  }
                } catch (error) {
                  console.error("Error sending code:", error);
                  Alert.alert(
                    "Error",
                    error.message || "Failed to send verification code",
                  );
                  await safeHaptics.notify(
                    Haptics.NotificationFeedbackType.Error,
                  );
                } finally {
                  setLoading(false);
                }
              },
            },
          ],
        );
        return;
      }

      // Phone number doesn't exist, proceed with signup
      const response = await apiFetch("/api/auth/phone-send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          channel: preferredOtpChannel,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
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
      setCodeSent(true);
      setStep(2);

      Alert.alert("Code Sent", "We sent you a verification code on WhatsApp.");
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

      await safeHaptics.notify(Haptics.NotificationFeedbackType.Success);
      setStep(3);
    } catch (error) {
      console.error("Error verifying code:", error);
      Alert.alert("Error", error.message || "Invalid verification code");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !birthday) {
      Alert.alert("Error", "Please fill in all fields");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!consentGiven) {
      Alert.alert("Error", "Please consent to data collection to continue");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const age = calculateAge(birthday);

    // Check if user is at least 13 years old
    if (age < 13) {
      Alert.alert(
        "Age Requirement",
        "You must be at least 13 years old to create an account",
      );
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const fullPhone = `${countryCode} ${phone}`;
    setLoading(true);

    try {
      const formattedBirthday = formatBirthdayForAPI(birthday);

      const response = await apiFetch("/api/auth/phone-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          firstName,
          lastName,
          birthday: formattedBirthday,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      const canonicalPhone = data?.user?.phone || fullPhone;

      // Legacy (some screens still read AsyncStorage)
      await AsyncStorage.setItem("userPhone", canonicalPhone);
      await AsyncStorage.setItem("userData", JSON.stringify(data.user));

      // Primary (what useAuth reads)
      await phoneAuth.verifyPhone(canonicalPhone);

      setAuth({
        user: data.user,
        phone: canonicalPhone,
      });

      await safeHaptics.notify(Haptics.NotificationFeedbackType.Success);

      if (!isModalOpen) {
        router.replace("/select-branch");
      }
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", error.message || "Failed to create account");
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const goBackToPhoneStep = async () => {
    await safeHaptics.selection();
    setStep(1);
    setVerificationCode("");
  };

  return {
    loading,
    step,
    countryCode,
    setCountryCode,
    phone,
    setPhone,
    codeSent,
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
    debugCode: null,
  };
}
