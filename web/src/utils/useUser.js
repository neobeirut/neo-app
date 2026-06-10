import * as React from "react";

const useUser = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const fetchUser = React.useCallback(async () => {
    console.log("[useUser] Starting fetchUser...");
    try {
      console.log("[useUser] Fetching /api/auth/token");
      const response = await fetch("/api/auth/token");

      console.log(
        "[useUser] Response status:",
        response.status,
        response.statusText,
      );
      console.log("[useUser] Response OK:", response.ok);

      if (!response.ok) {
        // 401 is expected when not logged in, don't log it as an error
        if (response.status !== 401) {
          console.error(
            "[useUser] Error fetching user:",
            response.status,
            response.statusText,
          );
        } else {
          console.log(
            "[useUser] User not authenticated (401 - expected when not logged in)",
          );
        }

        // Try to read error response
        try {
          const errorData = await response.json();
          console.log("[useUser] Error response data:", errorData);
        } catch (e) {
          console.log("[useUser] Could not parse error response");
        }

        setUser(null);
        return null;
      }

      const data = await response.json();
      console.log("[useUser] Response data:", data);

      const userData = data.user || null;
      console.log("[useUser] User data:", userData);

      setUser(userData);
      return userData;
    } catch (error) {
      // Only log unexpected errors
      console.error("[useUser] Unexpected error fetching user:", error);
      console.error("[useUser] Error stack:", error.stack);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
      console.log("[useUser] Fetch complete");
    }
  }, []);

  React.useEffect(() => {
    console.log("[useUser] Component mounted, calling fetchUser");
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    data: user,
    loading,
    refetch: fetchUser,
  };
};

export { useUser };

export default useUser;
