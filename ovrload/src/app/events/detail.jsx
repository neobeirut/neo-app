import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  CalendarPlus,
} from "lucide-react-native";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as Calendar from "expo-calendar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { PlayfairDisplay_500Medium } from "@expo-google-fonts/playfair-display";

import { useTheme } from "../../utils/theme";
import { getImageSource } from "../../utils/apiFetch";
import { useEvent } from "../../hooks/useEvents";

function formatRange(event) {
  try {
    const start = event?.start_at ? new Date(event.start_at) : null;
    const end = event?.end_at ? new Date(event.end_at) : null;

    if (!start || Number.isNaN(start.getTime())) return "";

    const startLabel = format(start, "EEE, MMM d • h:mm a");
    if (!end || Number.isNaN(end.getTime())) return startLabel;

    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    const endLabel = sameDay
      ? format(end, "h:mm a")
      : format(end, "EEE, MMM d • h:mm a");

    return `${startLabel} - ${endLabel}`;
  } catch (e) {
    return "";
  }
}

function sanitizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/[^0-9+]/g, "");
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const eventId = params?.id ? String(params.id) : null;
  const occurrenceStartAt = params?.occurrence_start_at
    ? String(params.occurrence_start_at)
    : null;

  const { colors, statusBarStyle } = useTheme();

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_500Medium,
  });

  const { data, isLoading, error } = useEvent(eventId, {
    occurrenceStartAt,
  });
  const event = data?.event || null;

  const cancelled = event?.status === "cancelled";
  const reservationTabEnabled = !!event?.show_in_reservation_tab;

  const imageUrls = useMemo(() => {
    const extras = Array.isArray(event?.images) ? event.images : [];
    const all = [event?.cover_image, ...extras].filter(Boolean);
    // de-dupe
    const seen = new Set();
    const uniq = [];
    for (const u of all) {
      const key = String(u);
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(key);
      }
    }
    return uniq;
  }, [event?.cover_image, event?.images]);

  const safeHaptics = {
    selection: async () => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.selectionAsync();
      } catch (e) {
        // ignore
      }
    },
  };

  const onShare = async () => {
    try {
      await safeHaptics.selection();
      const msg = event?.name ? `Event: ${event.name}` : "Event";
      await Share.share({ message: msg });
    } catch (e) {
      // ignore
    }
  };

  const onAddToCalendar = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Add to Calendar works on your phone.");
      return;
    }

    try {
      await safeHaptics.selection();

      const available = await Calendar.isAvailableAsync();
      if (!available) {
        Alert.alert(
          "Not available",
          "Calendar is not available on this device.",
        );
        return;
      }

      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Calendar permission was not granted.",
        );
        return;
      }

      const startDate = event?.start_at ? new Date(event.start_at) : null;
      if (!startDate || Number.isNaN(startDate.getTime())) {
        Alert.alert("Missing date", "This event has no valid start time.");
        return;
      }

      const endDate = event?.end_at ? new Date(event.end_at) : null;
      const fallbackEnd = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      const finalEnd =
        endDate && !Number.isNaN(endDate.getTime()) ? endDate : fallbackEnd;

      await Calendar.createEventInCalendarAsync({
        title: event?.name || "Event",
        startDate,
        endDate: finalEnd,
        notes: event?.description || "",
      });
    } catch (e) {
      console.error("[events/detail] Add to calendar failed", e);
      Alert.alert("Error", "Could not add to calendar.");
    }
  };

  const onReserve = async () => {
    if (!event) return;

    if (cancelled) {
      return;
    }

    // Reservation is marked as required, but not yet enabled for the reservation tab
    // (typically because URL/phone isn't live yet)
    if (event?.reservation_required && !reservationTabEnabled) {
      Alert.alert(
        "Coming soon",
        "Reservations for this event are not open yet.",
      );
      return;
    }

    try {
      await safeHaptics.selection();

      const reserveUrl = event?.reservation_url
        ? String(event.reservation_url)
        : "";
      const reservePhone = sanitizePhone(event?.reservation_phone);

      if (reserveUrl) {
        await Linking.openURL(reserveUrl);
        return;
      }

      if (reservePhone) {
        const when = formatRange(event);
        const message = `Hi, I'd like to reserve for ${event.name} on ${when}.`;

        const phoneDigits = reservePhone.replace(/\+/g, "");
        const waUrl = `https://wa.me/${encodeURIComponent(phoneDigits)}?text=${encodeURIComponent(message)}`;

        const canOpenWa = await Linking.canOpenURL(waUrl);
        if (canOpenWa) {
          await Linking.openURL(waUrl);
          return;
        }

        const telUrl = `tel:${reservePhone}`;
        const canOpenTel = await Linking.canOpenURL(telUrl);
        if (canOpenTel) {
          await Linking.openURL(telUrl);
          return;
        }

        Alert.alert("Cannot open", "Could not open WhatsApp or the dialer.");
        return;
      }

      Alert.alert(
        "Reservation",
        "No reservation link or phone is set for this event.",
      );
    } catch (e) {
      console.error("[events/detail] reserve failed", e);
      Alert.alert("Error", "Could not open reservation.");
    }
  };

  if (!loaded) {
    return null;
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style={statusBarStyle} />
        <Text style={{ fontFamily: "Inter_500Medium", color: colors.text }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <StatusBar style={statusBarStyle} />
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            color: colors.text,
            textAlign: "center",
          }}
        >
          Could not load this event.
        </Text>
      </View>
    );
  }

  const dateLabel = formatRange(event);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 14,
            color: colors.textSecondary,
          }}
        >
          Event Details
        </Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover + images */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
        >
          {imageUrls.map((url) => {
            const src = getImageSource(url);
            return (
              <View
                key={url}
                style={{ width: 320, height: 220, marginLeft: 16 }}
              >
                <Image
                  source={src}
                  style={{ width: "100%", height: "100%", borderRadius: 18 }}
                  contentFit="cover"
                  transition={160}
                />
              </View>
            );
          })}
          <View style={{ width: 16 }} />
        </ScrollView>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          {cancelled ? (
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderWidth: 1,
                borderColor: colors.separator,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  color: "#ef4444",
                }}
              >
                Cancelled
              </Text>
            </View>
          ) : null}

          <Text
            style={{
              marginTop: cancelled ? 10 : 0,
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 28,
              color: colors.text,
            }}
          >
            {event.name}
          </Text>

          {dateLabel ? (
            <Text
              style={{
                marginTop: 8,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {dateLabel}
            </Text>
          ) : null}

          {event.description ? (
            <Text
              style={{
                marginTop: 12,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
                lineHeight: 22,
                color: colors.text,
              }}
            >
              {event.description}
            </Text>
          ) : null}

          {/* Reservation / actions */}
          <View
            style={{
              marginTop: 18,
              backgroundColor: colors.background,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.separator,
              padding: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: colors.text,
              }}
            >
              {event.reservation_required ? "Reservation" : "Actions"}
            </Text>

            {event.price ? (
              <Text
                style={{
                  marginTop: 6,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: colors.textSecondary,
                }}
              >
                Price: {event.currency ? `${event.currency} ` : ""}
                {String(event.price)}
              </Text>
            ) : null}

            {event.reservation_required ? (
              <>
                <TouchableOpacity
                  onPress={onReserve}
                  disabled={cancelled || !reservationTabEnabled}
                  style={{
                    marginTop: 12,
                    backgroundColor:
                      cancelled || !reservationTabEnabled
                        ? colors.separator
                        : colors.primary,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <ExternalLink size={16} color={"white"} />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                      color: "white",
                    }}
                  >
                    {reservationTabEnabled ? "Reserve" : "Reservations soon"}
                  </Text>
                </TouchableOpacity>

                {!reservationTabEnabled ? (
                  <Text
                    style={{
                      marginTop: 10,
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                      color: colors.textSecondary,
                    }}
                  >
                    Reservations aren’t open yet for this event.
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={onShare}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.separator,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Share2 size={16} color={colors.text} />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                      color: colors.text,
                    }}
                  >
                    Share
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onAddToCalendar}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.separator,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <CalendarPlus size={16} color={colors.text} />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                      color: colors.text,
                    }}
                  >
                    Calendar
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
