import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";
import { apiFetch } from "@/utils/apiFetch";

export function useEventsList({
  tab,
  search,
  reservationRequired,
  featuredOnly,
  limit,
  offset,
  enabled = true,
}) {
  return useQuery({
    queryKey: [
      "events",
      tab,
      search || "",
      reservationRequired === null ? "all" : String(reservationRequired),
      featuredOnly ? "featured" : "all",
      limit,
      offset,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("tab", tab);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (search) params.set("search", search);
      if (reservationRequired !== null)
        params.set("reservation_required", String(reservationRequired));
      if (featuredOnly) params.set("featured", "true");

      const response = await apiFetch(`/api/events?${params.toString()}`);
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to fetch events (${response.status}) ${response.statusText} ${text}`,
        );
      }
      return response.json();
    },
    enabled,
    retry: Platform.OS === "web" ? 0 : 1,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useEvent(id, { occurrenceStartAt } = {}) {
  const eventId = id ? String(id) : null;
  const occ = occurrenceStartAt ? String(occurrenceStartAt) : null;

  return useQuery({
    queryKey: ["event", eventId, occ || "base"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (occ) {
        params.set("occurrence_start_at", occ);
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";

      const response = await apiFetch(
        `/api/events/${encodeURIComponent(eventId)}${suffix}`,
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to fetch event (${response.status}) ${response.statusText} ${text}`,
        );
      }
      return response.json();
    },
    enabled: !!eventId,
    retry: Platform.OS === "web" ? 0 : 1,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
