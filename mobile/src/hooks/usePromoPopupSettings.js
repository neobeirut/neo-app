import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/utils/apiFetch";

export function usePromoPopupSettings() {
  return useQuery({
    queryKey: ["promo-popup-settings"],
    queryFn: async () => {
      const response = await apiFetch("/api/settings/promo-popup");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/settings/promo-popup, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export default usePromoPopupSettings;
