import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ArrowLeft, Play, Share2, X } from "lucide-react-native";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
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

const PLACEHOLDER_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function VideoPlayerModal({ visible, url, onClose, insets }) {
  const urlToUse = url || PLACEHOLDER_VIDEO;

  // IMPORTANT: hooks must not be called conditionally
  const player = useVideoPlayer(urlToUse, (p) => {
    p.loop = true;
    p.pause();
  });

  useEffect(() => {
    try {
      if (visible && url) {
        player.play();
      } else {
        player.pause();
      }
    } catch (e) {
      // ignore
    }
  }, [visible, url, player]);

  if (!visible || !url) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.92)",
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 10,
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "white",
            }}
          >
            Video
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 10 }}>
            <X size={22} color="white" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <VideoView
            player={player}
            allowsFullscreen
            nativeControls
            contentFit="contain"
            style={{ width: "100%", height: 320, backgroundColor: "black" }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function EventRecapScreen() {
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

  const past = isPastEvent(event);

  const gridItems = useMemo(() => {
    const imgs = Array.isArray(event?.recap_images) ? event.recap_images : [];
    const vids = Array.isArray(event?.recap_videos) ? event.recap_videos : [];

    const out = [];
    imgs.forEach((u, idx) =>
      out.push({ key: `img-${idx}-${u}`, type: "image", url: u }),
    );
    vids.forEach((u, idx) =>
      out.push({ key: `vid-${idx}-${u}`, type: "video", url: u }),
    );

    return out;
  }, [event?.recap_images, event?.recap_videos]);

  const [imageModalUrl, setImageModalUrl] = useState(null);
  const [videoModalUrl, setVideoModalUrl] = useState(null);

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
      const msg = event?.name
        ? `Past event recap: ${event.name}`
        : "Past event recap";
      await Share.share({ message: msg });
    } catch (e) {
      // ignore
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
          Could not load this recap.
        </Text>
      </View>
    );
  }

  const dateLabel = (() => {
    try {
      const start = event?.start_at ? new Date(event.start_at) : null;
      if (!start || Number.isNaN(start.getTime())) return "";
      return format(start, "EEE, MMM d, yyyy");
    } catch (e) {
      return "";
    }
  })();

  const showPlaceholder = !gridItems.length;

  const renderGridItem = ({ item }) => {
    const onPress = async () => {
      await safeHaptics.selection();
      if (item.type === "image") {
        setImageModalUrl(item.url);
      } else {
        setVideoModalUrl(item.url);
      }
    };

    if (item.type === "video") {
      return (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={{
            flex: 1,
            aspectRatio: 1,
            margin: 5,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.separator,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Play size={28} color={colors.text} />
          <Text
            style={{
              marginTop: 6,
              fontFamily: "Inter_500Medium",
              fontSize: 11,
              color: colors.textSecondary,
            }}
            numberOfLines={1}
          >
            Video
          </Text>
        </TouchableOpacity>
      );
    }

    const src = getImageSource(item.url);
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{
          flex: 1,
          aspectRatio: 1,
          margin: 5,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.separator,
          overflow: "hidden",
        }}
      >
        <Image
          source={src}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={120}
        />
      </TouchableOpacity>
    );
  };

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
          Past Event
        </Text>

        <TouchableOpacity onPress={onShare} style={{ padding: 10 }}>
          <Share2 size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 26,
            color: colors.text,
          }}
        >
          {event.name}
        </Text>

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

        {event.recap_caption ? (
          <Text
            style={{
              marginTop: 12,
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              lineHeight: 22,
              color: colors.text,
            }}
          >
            {event.recap_caption}
          </Text>
        ) : null}

        {!past ? (
          <Text
            style={{
              marginTop: 12,
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            Note: this event is not marked as past yet.
          </Text>
        ) : null}
      </View>

      {showPlaceholder ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: colors.text,
              textAlign: "center",
            }}
          >
            Recap coming soon
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            Photos and videos will appear here once uploaded.
          </Text>
        </View>
      ) : (
        <FlatList
          data={gridItems}
          renderItem={renderGridItem}
          keyExtractor={(it) => it.key}
          numColumns={3}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 11,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Image full screen */}
      <Modal
        visible={!!imageModalUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalUrl(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: "white",
              }}
            >
              Photo
            </Text>
            <TouchableOpacity
              onPress={() => setImageModalUrl(null)}
              style={{ padding: 10 }}
            >
              <X size={22} color="white" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, justifyContent: "center", padding: 12 }}>
            {imageModalUrl ? (
              <Image
                source={getImageSource(imageModalUrl)}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                transition={100}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Video player */}
      <VideoPlayerModal
        visible={!!videoModalUrl}
        url={videoModalUrl}
        onClose={() => setVideoModalUrl(null)}
        insets={insets}
      />
    </View>
  );
}
