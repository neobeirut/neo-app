import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ReviewItem } from "./ReviewItem";

export function RatingSection({
  colors,
  userRating,
  setUserRating,
  onSubmitRating,
  isSubmitting,
  reviews,
  isAuthenticated,
  signIn,
}) {
  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 16,
            color: colors.text,
            marginBottom: 16,
          }}
        >
          Rate This Product
        </Text>

        {/* Star Rating */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginBottom: 16,
            justifyContent: "center",
          }}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setUserRating(star)}
              style={{
                padding: 8,
              }}
            >
              <Ionicons
                name={star <= userRating ? "star" : "star-outline"}
                size={28}
                color={
                  star <= userRating ? colors.primary : colors.textSecondary
                }
              />
            </TouchableOpacity>
          ))}
        </View>

        {userRating > 0 && (
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 24,
              alignItems: "center",
            }}
            onPress={onSubmitRating}
            disabled={isSubmitting}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: "white",
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit Rating"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reviews List */}
      {reviews && reviews.length > 0 && (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 18,
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Reviews
          </Text>
          {reviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              colors={colors}
              isAuthenticated={isAuthenticated}
              signIn={signIn}
            />
          ))}
        </View>
      )}
    </View>
  );
}
