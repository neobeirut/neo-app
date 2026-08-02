import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { Edit } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

export function EditProfileButton({ colors }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.separator,
      }}
      onPress={async () => {
        await Haptics.selectionAsync();
        router.push("/edit-profile");
      }}
    >
      <Edit size={20} color={colors.primary} />
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          color: colors.primary,
        }}
      >
        Edit Profile
      </Text>
    </TouchableOpacity>
  );
}
