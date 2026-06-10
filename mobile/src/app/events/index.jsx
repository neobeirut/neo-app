import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Menu, Star, CalendarDays } from "lucide-react-native";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { PlayfairDisplay_500Medium } from "@expo-google-fonts/playfair-display";

import { useTheme } from "../../utils/theme";
import { useBranchStore } from "../../utils/branchStore";
import { useAuth } from "../../utils/auth/useAuth";
import { useHomeActions } from "../../hooks/useHomeActions";
import { useCartData } from "../../hooks/useCartData";
import { SlideMenu } from "../../components/Home/SlideMenu";
import { getImageSource } from "../../utils/apiFetch";
import { useEventsList } from "../../hooks/useEvents";

function isPastEvent(event) {
  const end = event?.end_at ? new Date(event.end_at) : null;
  const start = event?.start_at ? new Date(event.start_at) : null;

  const now = new Date();
  const compare = end && !Number.isNaN(end.getTime()) ? end : start;

  if (!compare || Number.isNaN(compare.getTime())) {
    return false;
  }

  return compare.getTime() < now.getTime();
}

function formatEventDateRange(event) {
  try {
    const start = event?.start_at ? new Date(event.start_at) : null;
    const end = event?.end_at ? new Date(event.end_at) : null;

    if (!start || Number.isNaN(start.getTime())) {
      return "";
    }

    const startLabel = format(start, "EEE, MMM d • h:mm a");

    if (!end || Number.isNaN(end.getTime())) {
      return startLabel;
    }

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

function Badge({ label, colors, tone }) {
  const bg =
    tone === "danger"
      ? "rgba(239, 68, 68, 0.15)"
      : tone === "muted"
        ? colors.surface
        : "rgba(16, 185, 129, 0.15)";

  const color =
    tone === "danger" ? "#ef4444" : tone === "muted" ? colors.text : "#10b981";

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.separator,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function EventsIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();

  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { isAuthenticated, isReady } = useAuth();

  const [menuVisible, setMenuVisible] = useState(false);

  const { data: cartData } = useCartData(
    selectedBranch,
    isAuthenticated,
    isReady,
  );

  const { handleChangeLocation } = useHomeActions(
    selectedBranch,
    setSelectedBranch,
    router,
    isAuthenticated,
    isReady,
  );

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

  const [tab, setTab] = useState("upcoming"); // upcoming | past
  const [search, setSearch] = useState("");
  const [reservationFilter, setReservationFilter] = useState(null); // null | true | false
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const limit = 12;
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);

  const eventsQuery = useEventsList({
    tab,
    search: search.trim(),
    reservationRequired: reservationFilter,
    featuredOnly,
    limit,
    offset,
    enabled: true,
  });

  useEffect(() => {
    // Reset pagination when filters change
    setOffset(0);
  }, [tab, search, reservationFilter, featuredOnly]);

  useEffect(() => {
    const payload = eventsQuery.data;
    const nextEvents = payload?.events || [];
    const nextHasMore = !!payload?.pagination?.has_more;

    if (offset === 0) {
      setItems(nextEvents);
    } else if (nextEvents.length) {
      setItems((prev) => [...prev, ...nextEvents]);
    }

    setHasMore(nextHasMore);
  }, [eventsQuery.data, offset]);

  const onRefresh = useCallback(async () => {
    setOffset(0);
    await eventsQuery.refetch();
  }, [eventsQuery]);

  const loadMore = useCallback(() => {
    if (eventsQuery.isLoading) return;
    if (!hasMore) return;
    setOffset((v) => v + limit);
  }, [eventsQuery.isLoading, hasMore]);

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_500Medium,
  });

  if (!loaded) {
    return null;
  }

  const header = (
    <View style={{ paddingHorizontal: 24 }}>
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{ padding: 10 }}
        >
          <Menu size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <CalendarDays size={20} color={colors.text} />
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 22,
              color: colors.text,
            }}
          >
            Events
          </Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      {/* Segmented control */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.separator,
        }}
      >
        {[
          { id: "upcoming", label: "Upcoming" },
          { id: "past", label: "Past Events" },
        ].map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={async () => {
                await safeHaptics.selection();
                setTab(t.id);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: active ? colors.background : "transparent",
                borderWidth: active ? 1 : 0,
                borderColor: colors.separator,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                  fontSize: 13,
                  color: colors.text,
                }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filters */}
      <View style={{ marginTop: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search events"
          placeholderTextColor={colors.textSecondary}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.separator,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.text,
          }}
        />

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {[
            { id: "all", label: "All", value: null },
            { id: "required", label: "Reservation", value: true },
            { id: "walkin", label: "Walk-in", value: false },
          ].map((opt) => {
            const active = reservationFilter === opt.value;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={async () => {
                  await safeHaptics.selection();
                  setReservationFilter(opt.value);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.separator,
                }}
              >
                <Text
                  style={{
                    fontFamily: active
                      ? "Inter_600SemiBold"
                      : "Inter_500Medium",
                    fontSize: 12,
                    color: active ? "white" : colors.text,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={async () => {
              await safeHaptics.selection();
              setFeaturedOnly((v) => !v);
            }}
            style={{
              marginLeft: "auto",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: featuredOnly
                ? "rgba(250, 204, 21, 0.18)"
                : colors.surface,
              borderWidth: 1,
              borderColor: colors.separator,
            }}
          >
            <Star size={14} color={featuredOnly ? "#f59e0b" : colors.text} />
            <Text
              style={{
                fontFamily: featuredOnly
                  ? "Inter_600SemiBold"
                  : "Inter_500Medium",
                fontSize: 12,
                color: colors.text,
              }}
            >
              Featured
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {eventsQuery.error ? (
        <Text
          style={{
            marginTop: 12,
            fontFamily: "Inter_400Regular",
            color: "#ef4444",
          }}
        >
          Could not load events.
        </Text>
      ) : null}

      <View style={{ height: 14 }} />
    </View>
  );

  const emptyText =
    tab === "past" ? "No past events yet." : "No upcoming events yet.";

  const renderItem = ({ item }) => {
    const cancelled = item?.status === "cancelled";
    const past = isPastEvent(item);
    const dateLabel = formatEventDateRange(item);

    const recapCountText =
      item?.recap_images_count || item?.recap_videos_count
        ? `${item?.recap_images_count || 0} photos • ${item?.recap_videos_count || 0} videos`
        : null;

    const imageSource = getImageSource(item?.cover_image);

    const reservationTabEnabled = !!item?.show_in_reservation_tab;

    const primaryBadge = cancelled
      ? { label: "Cancelled", tone: "danger" }
      : past
        ? { label: "Past Event", tone: "muted" }
        : item?.reservation_required
          ? reservationTabEnabled
            ? { label: "Reservation Required", tone: "success" }
            : { label: "Reservations soon", tone: "muted" }
          : { label: "Walk-in", tone: "muted" };

    const onPress = async () => {
      await safeHaptics.selection();
      const route = past ? "/events/recap" : "/events/detail";

      const occurrenceStartAt = item?.occurrence_start_at || item?.start_at;

      const params = { id: String(item.id) };
      if (item?.is_recurring && occurrenceStartAt) {
        params.occurrence_start_at = String(occurrenceStartAt);
      }

      router.push({ pathname: route, params });
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{
          marginHorizontal: 24,
          marginBottom: 14,
          backgroundColor: colors.background,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.separator,
          overflow: "hidden",
        }}
      >
        <View style={{ height: 160, backgroundColor: colors.surface }}>
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={120}
          />
        </View>

        <View style={{ padding: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 18,
                color: colors.text,
              }}
              numberOfLines={2}
            >
              {item?.name}
            </Text>

            {item?.featured ? (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "rgba(250, 204, 21, 0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Star size={16} color="#f59e0b" />
              </View>
            ) : null}
          </View>

          {dateLabel ? (
            <Text
              style={{
                marginTop: 6,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              {dateLabel}
            </Text>
          ) : null}

          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Badge
              label={primaryBadge.label}
              colors={colors}
              tone={primaryBadge.tone}
            />
            {item?.price ? (
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  color: colors.text,
                }}
              >
                {item?.currency ? `${item.currency} ` : ""}
                {String(item.price)}
              </Text>
            ) : null}
          </View>

          {tab === "past" && recapCountText ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: colors.textSecondary,
              }}
            >
              {recapCountText}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <StatusBar style={statusBarStyle} />

      <FlatList
        data={items}
        keyExtractor={(item) => {
          const occ = item?.occurrence_start_at || item?.start_at || "";
          const key = item?.is_recurring
            ? `${item?.id}_${occ}`
            : String(item?.id);
          return key;
        }}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isFetching && offset === 0}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListEmptyComponent={
          eventsQuery.isLoading ? null : (
            <View style={{ paddingHorizontal: 24, paddingTop: 50 }}>
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: colors.textSecondary,
                }}
              >
                {emptyText}
              </Text>
            </View>
          )
        }
      />

      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={() => handleChangeLocation(cartData)}
        onHomePress={null}
      />
    </View>
  );
}
