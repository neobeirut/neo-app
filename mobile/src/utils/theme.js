import { useColorScheme } from "react-native";

export function useTheme() {
  // Always use light theme
  return {
    isDark: false,
    colors: {
      // Background colors - white
      background: "#FFFFFF",
      surface: "#F9F9F9",
      elevated: "#F5F5F5",
      card: "#FFFFFF",

      // Text colors
      text: "#1A1A1A",
      textSecondary: "#666666",
      textMuted: "#999999",

      // Brand colors - NEO green
      primary: "#235b4e",
      primaryMuted: "#F0F5F3",
      primaryLight: "#2B6B5C",

      // Secondary accent
      secondary: "#B8935A",
      secondaryMuted: "#FDF8F0",
      secondaryLight: "#C69F66",

      // UI colors
      border: "#E0E0E0",
      borderLight: "#F0F0F0",
      separator: "#ECECEC",

      // Status colors
      success: "#3A8A5A",
      warning: "#D4933F",
      error: "#D85555",

      // Special colors
      cream: "#FAFAFA",
      warm: "#F4F0E8",
      golden: "#D4B885",

      // Overlay and accent
      overlay: "rgba(44, 42, 37, 0.60)",
      accent: "#A67C52",
    },
    statusBarStyle: "dark",
  };
}
