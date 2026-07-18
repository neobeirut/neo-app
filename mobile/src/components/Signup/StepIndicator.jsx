import { View } from "react-native";

export function StepIndicator({ currentStep }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginBottom: 32,
        justifyContent: "center",
      }}
    >
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={{
            width: currentStep >= s ? 40 : 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: currentStep >= s ? "#357AFF" : "#E5E7EB",
          }}
        />
      ))}
    </View>
  );
}
