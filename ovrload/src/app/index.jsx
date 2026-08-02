import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useBranchStore } from "../utils/branchStore";
import { useAuth } from "../utils/auth/useAuth";
import { apiFetch } from "../utils/apiFetch";

export default function Index() {
  const { isReady } = useAuth();
  const { selectedBranch, loadSelectedBranch, setSelectedBranch } = useBranchStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        await loadSelectedBranch();

        // If no branch was previously saved, fetch branches. If only 1 branch exists, auto-select it.
        const currentBranch = useBranchStore.getState().selectedBranch;
        if (!currentBranch?.id) {
          const response = await apiFetch("/api/branches");
          if (response.ok) {
            const data = await response.json();
            const activeBranches = (data.branches || []).filter((b) => b.is_active);
            if (activeBranches.length === 1 && mounted) {
              await setSelectedBranch(activeBranches[0]);
            }
          }
        }
      } catch (error) {
        console.error("[INDEX] Error loading branch:", error);
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadSelectedBranch, setSelectedBranch]);

  if (!isReady || !hydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#357AFF" />
      </View>
    );
  }

  // If a branch is selected (or auto-selected), go straight to home.
  if (selectedBranch?.id) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/select-branch" />;
}