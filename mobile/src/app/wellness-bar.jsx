import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronDown, ChevronUp, AlertCircle, Leaf, Sparkles, Trash2 } from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../utils/apiFetch";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";

// Sub-component for individual history items to keep their local expanded state
function HistoryCard({ item, colors, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpanded(!expanded);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#10b981"; // Emerald
    if (score >= 50) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
      <View style={styles.cardHeaderRow}>
        <TouchableOpacity onPress={toggleExpanded} activeOpacity={0.8} style={styles.headerClickableArea}>
          <View style={styles.headerMain}>
            <Text numberOfLines={1} style={[styles.foodName, { color: colors.text }]}>
              {item.food_name}
            </Text>
            <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          
          <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.wellness_score) + "15" }]}>
            <Sparkles size={12} color={getScoreColor(item.wellness_score)} style={{ marginRight: 4 }} />
            <Text style={[styles.scoreText, { color: getScoreColor(item.wellness_score) }]}>
              {item.wellness_score}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteButton} activeOpacity={0.7}>
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleExpanded} style={styles.chevronButton} activeOpacity={0.7}>
            {expanded ? (
              <ChevronUp size={20} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Basic Stats row (always visible) */}
      <View style={styles.statsSummaryRow}>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatVal, { color: colors.text }]}>{item.calories}</Text>
          <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>kcal</Text>
        </View>
        <View style={styles.summaryStatDivider} />
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatVal, { color: colors.text }]}>{item.protein_g}g</Text>
          <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>Protein</Text>
        </View>
        <View style={styles.summaryStatDivider} />
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatVal, { color: colors.text }]}>{item.carbs_g}g</Text>
          <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>Carbs</Text>
        </View>
        <View style={styles.summaryStatDivider} />
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatVal, { color: colors.text }]}>{item.fat_g}g</Text>
          <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>Fat</Text>
        </View>
        <View style={styles.summaryStatDivider} />
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatVal, { color: colors.text }]}>{item.fiber_g || 0}g</Text>
          <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}>Fiber</Text>
        </View>
      </View>

      {/* Expanded details (ingredients and description) */}
      {expanded && (
        <View style={styles.expandedDetails}>
          <View style={styles.cardDivider} />
          
          {item.description && (
            <View style={[styles.descCallout, { backgroundColor: colors.background }]}>
              <Text style={[styles.descText, { color: colors.text }]}>
                {item.description}
              </Text>
            </View>
          )}

          {item.ingredients && item.ingredients.length > 0 && (
            <View style={styles.ingredientsContainer}>
              <Text style={[styles.ingredientsTitle, { color: colors.text }]}>Ingredients Detected</Text>
              <View style={styles.ingredientsList}>
                {item.ingredients.map((ing, idx) => (
                  <View key={idx} style={[styles.ingBadge, { backgroundColor: colors.background, borderColor: colors.separator }]}>
                    <Text style={[styles.ingText, { color: colors.text }]}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function WellnessBarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { isAuthenticated, signIn, isReady } = useAuth();

  // Fetch wellness history using React Query
  const { data: history, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["wellness-history"],
    queryFn: async () => {
      const localUrl = "/api/nutrition/history";
      const response = await apiFetch(localUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch wellness history");
      }
      return response.json();
    },
    enabled: !!isAuthenticated,
  });

  const handleDelete = async (itemId) => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this scan from your history?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              const localUrl = `/api/nutrition/history?id=${itemId}`;
              const response = await apiFetch(localUrl, {
                method: "DELETE",
              });
              if (!response.ok) {
                throw new Error("Failed to delete record");
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              queryClient.invalidateQueries({ queryKey: ["wellness-history"] });
            } catch (err) {
              Alert.alert("Error", err.message || "Failed to delete record");
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refetch();
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleBack}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wellness Bar</Text>
        <View style={{ width: 44 }} />
      </View>

      {!isReady ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D5F3F" />
        </View>
      ) : !isAuthenticated ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.surface }]}>
            <Leaf size={48} color="#2D5F3F" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Please sign in to track and view your wellness history.
          </Text>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              signIn();
            }}
          >
            <Text style={styles.scanBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !isRefetching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D5F3F" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading wellness history...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 12 }} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error.message || "Failed to load history"}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !history || history.length === 0 ? (
        // Empty State
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.surface }]}>
            <Leaf size={48} color="#2D5F3F" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Your Wellness Bar is Empty</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Scan your healthy meals using the plate scanner to track calories, protein, and wellness scores over time.
          </Text>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.push("/scanner");
            }}
          >
            <Text style={styles.scanBtnText}>Scan My Plate</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // History List
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#2D5F3F" />
          }
        >
          <View style={styles.historyList}>
            {history.map((item) => (
              <HistoryCard key={item.id} item={item} colors={colors} onDelete={handleDelete} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerBtn: {
    padding: 8,
    width: 44,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "#2D5F3F",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  scanBtn: {
    backgroundColor: "#2D5F3F",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  scanBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    fontSize: 15,
  },
  scrollContent: {
    padding: 16,
  },
  historyList: {
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerClickableArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerMain: {
    flex: 1,
    paddingRight: 8,
  },
  foodName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    marginBottom: 4,
  },
  cardDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
  chevronButton: {
    padding: 4,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  statsSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  summaryStat: {
    alignItems: "center",
    flex: 1,
  },
  summaryStatVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginBottom: 2,
  },
  summaryStatLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  summaryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 14,
  },
  expandedDetails: {
    marginTop: 2,
  },
  descCallout: {
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#2D5F3F",
    marginBottom: 14,
  },
  descText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
  ingredientsContainer: {},
  ingredientsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  ingredientsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ingBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
});
