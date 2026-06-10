import React from "react";
import { Modal, View, TouchableOpacity, Platform } from "react-native";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import SignupScreen from "@/app/signup";
import SigninScreen from "@/app/signin";
import { useAuthStore, useAuthModal } from "./store";

/**
 * AuthModal
 * Renders the sign-in / sign-up screens inside a modal.
 * Note: In web preview, haptics can throw; we guard it so the modal always closes.
 */
export const AuthModal = () => {
  const { isOpen, mode, close } = useAuthModal();
  const { auth } = useAuthStore();

  const handleClose = async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.selectionAsync();
      } catch (e) {
        console.warn("[AUTH MODAL] Haptics failed:", e?.message);
      }
    }

    close();
  };

  return (
    <Modal visible={isOpen && !auth} transparent={true} animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
        }}
      >
        <TouchableOpacity
          onPress={handleClose}
          style={{
            position: "absolute",
            top: 50,
            right: 20,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.1)",
            borderRadius: 20,
            padding: 8,
          }}
        >
          <X size={24} color="#1F2937" />
        </TouchableOpacity>

        {mode === "signup" ? <SignupScreen /> : <SigninScreen />}
      </View>
    </Modal>
  );
};

export default useAuthModal;
