import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useBranchStore } from "../utils/branchStore";
import { useAuth } from "../utils/auth/useAuth";

export default function Index() {
  const { isReady } = useAuth();
  const { selectedBranch, loadSelectedBranch } = useBranchStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        // IMPORTANT: do NOT clear the selected branch here.
        // We want branch + cart to persist through sign-in.
        await loadSelectedBranch();
      } catch (error) {
        console.error("[INDEX] Error loading saved branch:", error);
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
  }, [loadSelectedBranch]);

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

  // If the user already picked a branch before, keep them in that branch.
  if (selectedBranch?.id) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/select-branch" />;
}
