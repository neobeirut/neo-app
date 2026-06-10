import React, { useState, useCallback, useEffect } from "react";
import { View, ScrollView, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { useBranchStore } from "../utils/branchStore";
import { useOrderHistory } from "../hooks/useOrderHistory";
import { getFilteredOrders } from "../utils/orderHistoryHelpers";
import { OrderHistoryHeader } from "../components/OrderHistory/OrderHistoryHeader";
import { StatusFilterBar } from "../components/OrderHistory/StatusFilterBar";
import { OrderCard } from "../components/OrderHistory/OrderCard";
import { EmptyOrdersState } from "../components/OrderHistory/EmptyOrdersState";
import { LoadingState } from "../components/OrderHistory/LoadingState";
import { ErrorState } from "../components/OrderHistory/ErrorState";
import { useAuth } from "../utils/auth/useAuth";
import { maybeShowNotificationPrePrompt } from "../utils/notifications";

export default function OrderHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch } = useBranchStore();
  const { signIn, isAuthenticated, isReady } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState(null);

  const { orders, isLoading, refetch, isRefetching, error, reorderMutation } =
    useOrderHistory();

  const filteredOrders = getFilteredOrders(orders, selectedStatus);

  useEffect(() => {
    // Trigger B: first time user opens Orders / Order Tracking screen
    // Only if the user is signed in (this screen is auth-gated anyway).
    if (!isReady || !isAuthenticated) {
      return;
    }

    const t = setTimeout(() => {
      maybeShowNotificationPrePrompt("ordersPage").catch(() => null);
    }, 1000);

    return () => clearTimeout(t);
  }, [isReady, isAuthenticated]);

  const toggleOrderExpansion = async (orderId) => {
    await Haptics.selectionAsync();
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const handleReorder = async (order) => {
    await Haptics.selectionAsync();

    if (!selectedBranch) {
      Alert.alert(
        "Select Branch",
        "Please select a branch location before reordering.",
        [
          {
            text: "Select Branch",
            onPress: () => router.push("/select-branch"),
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }

    Alert.alert(
      "Reorder Confirmation",
      `Add all ${order.items?.length || 0} items from this order to your cart?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reorder",
          onPress: () =>
            reorderMutation.mutate({
              order,
              selectedBranch,
              onSuccess: () => {
                Alert.alert(
                  "Added to Cart",
                  "All items from this order have been added to your cart.",
                  [
                    { text: "Continue Shopping", style: "cancel" },
                    {
                      text: "View Cart",
                      onPress: () => router.push("/(tabs)/cart"),
                    },
                  ],
                );
              },
            }),
        },
      ],
    );
  };

  const goHome = useCallback(() => {
    // Always return to the Home tab (matches user expectation for "Back")
    router.replace("/(tabs)/home");
  }, [router]);

  if (isLoading) {
    return <LoadingState colors={colors} statusBarStyle={statusBarStyle} />;
  }

  if (error) {
    const isAuthRequired =
      String(error?.message || "") === "Authentication required";

    return (
      <ErrorState
        colors={colors}
        statusBarStyle={statusBarStyle}
        insets={insets}
        error={error}
        onBack={goHome}
        onRetry={refetch}
        isAuthRequired={isAuthRequired}
        onSignIn={signIn}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      <OrderHistoryHeader colors={colors} insets={insets} onBack={goHome} />

      <StatusFilterBar
        colors={colors}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        orders={orders}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {filteredOrders.length === 0 ? (
          <EmptyOrdersState colors={colors} selectedStatus={selectedStatus} />
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              colors={colors}
              isExpanded={expandedOrder === order.id}
              onToggleExpand={toggleOrderExpansion}
              onReorder={handleReorder}
              isReordering={reorderMutation.isPending}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
