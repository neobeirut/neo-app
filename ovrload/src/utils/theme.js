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

      // Brand colors - OVRLOAD orange
      primary: "#E05500",
      primaryMuted: "#FFF0E6",
      primaryLight: "#F06010",

      // Secondary accent - dark/near-black
      secondary: "#1A1A1A",
      secondaryMuted: "#F5F5F5",
      secondaryLight: "#333333",

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
      warm: "#FFF4EE",
      golden: "#E05500",

      // Overlay and accent
      overlay: "rgba(26, 26, 26, 0.60)",
      accent: "#E05500",
    },
    statusBarStyle: "dark",
  };
}
