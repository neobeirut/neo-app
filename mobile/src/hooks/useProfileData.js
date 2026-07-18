import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";

export function useProfileData(isAuthenticated) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const phone = await getAuthPhone();

      const params = new URLSearchParams();
      if (phone) params.append("phone", phone);

      const qs = params.toString();
      const url = qs ? `/api/users/profile?${qs}` : "/api/users/profile";

      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
    enabled: isAuthenticated,
  });
}
