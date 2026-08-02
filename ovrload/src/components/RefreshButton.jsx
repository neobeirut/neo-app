import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react-native";
import * as Haptics from "expo-haptics";

/**
 * Manual refresh button component that invalidates product and inventory caches
 * to force an immediate update from the server.
 *
 * Usage:
 * import RefreshButton from "@/components/RefreshButton";
 *
 * <RefreshButton
 *   branchId={selectedBranch?.id}
 *   variant="icon" // or "button"
 * />
 */
export default function RefreshButton({ branchId, variant = "icon" }) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    // Haptic feedback
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Ignore haptics errors
    }

    try {
      // Invalidate all product-related queries to force refetch
      await Promise.all(
        [
          queryClient.invalidateQueries({ queryKey: ["products"] }),
          branchId &&
            queryClient.invalidateQueries({
              queryKey: ["product-status", branchId],
            }),
          branchId &&
            queryClient.invalidateQueries({
              queryKey: ["categories", branchId],
            }),
        ].filter(Boolean),
      );

      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (variant === "button") {
    return (
      <TouchableOpacity
        onPress={handleRefresh}
        disabled={isRefreshing}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: isRefreshing ? "#E5E7EB" : "#357AFF",
          borderRadius: 8,
        }}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <RefreshCw size={16} color="#fff" />
        )}
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Text>
      </TouchableOpacity>
    );
  }

  // Icon variant (default)
  return (
    <TouchableOpacity
      onPress={handleRefresh}
      disabled={isRefreshing}
      style={{
        padding: 8,
        borderRadius: 8,
        backgroundColor: isRefreshing ? "#F3F4F6" : "transparent",
      }}
    >
      {isRefreshing ? (
        <ActivityIndicator size="small" color="#357AFF" />
      ) : (
        <RefreshCw size={24} color="#357AFF" />
      )}
    </TouchableOpacity>
  );
}
