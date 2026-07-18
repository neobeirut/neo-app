import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Star, Flag } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";

export function ReviewItem({ review, colors, isAuthenticated, signIn }) {
  const handleReportReview = async () => {
    if (!isAuthenticated) {
      signIn();
      return;
    }

    await Haptics.selectionAsync();

    Alert.alert("Report Review", "Why are you reporting this review?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Spam",
        onPress: () => submitReport("Spam or fake review"),
      },
      {
        text: "Offensive",
        onPress: () => submitReport("Offensive or inappropriate content"),
      },
      {
        text: "Other",
        onPress: () => submitReport("Other reason"),
      },
    ]);
  };

  const submitReport = async (reason) => {
    try {
      const phone = await getAuthPhone();
      const response = await apiFetch(
        `/api/products/${review.product_id}/reviews/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_id: review.id,
            reason,
            phone,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to report review");
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success",
        "Thank you for your report. We'll review it shortly.",
      );
    } catch (error) {
      console.error("Error reporting review:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.message || "Failed to report review. Please try again.",
      );
    }
  };

  return (
    <View
      style={{
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.text,
              }}
            >
              {review.user_name || "Anonymous"}
            </Text>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  color={i < review.rating ? "#F59E0B" : "#D1D5DB"}
                  fill={i < review.rating ? "#F59E0B" : "transparent"}
                />
              ))}
            </View>
          </View>
          {review.review_text && (
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              {review.review_text}
            </Text>
          )}
        </View>

        {/* Report Button */}
        <TouchableOpacity onPress={handleReportReview} style={{ padding: 4 }}>
          <Flag size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
