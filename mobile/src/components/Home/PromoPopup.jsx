import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Pressable,
  Dimensions,
  Platform,
  Text,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { getImageSource } from "@/utils/apiFetch";

let dismissedThisSessionVersion = null;

const STORAGE_KEY = "promo_popup_dismissed";

function toDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function safeParseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isInActiveRange(settings) {
  const now = new Date();
  const start = safeParseDate(settings?.start_at);
  const end = safeParseDate(settings?.end_at);

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

async function getDismissedRecord() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

async function setDismissedRecord(record) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    // ignore
  }
}

export default function PromoPopup({ settings, updatedAt, colors }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [decisionMade, setDecisionMade] = useState(false);

  const version = useMemo(() => {
    if (!updatedAt) return "";
    try {
      return String(new Date(updatedAt).getTime());
    } catch (e) {
      return String(updatedAt);
    }
  }, [updatedAt]);

  const imageSource = useMemo(() => {
    const url = settings?.image_url ? String(settings.image_url) : null;
    return url ? getImageSource(url) : null;
  }, [settings?.image_url]);

  const modalWidth = useMemo(() => {
    const w = Dimensions.get("window").width;
    return Math.min(Math.floor(w * 0.9), 560);
  }, []);

  const modalHeight = useMemo(() => {
    const h = Dimensions.get("window").height;
    return Math.max(320, Math.floor(h * 0.8));
  }, []);

  const shouldShow = useCallback(async () => {
    if (!settings?.enabled) return false;
    if (!settings?.image_url) return false;
    if (!isInActiveRange(settings)) return false;

    const freq = settings?.show_frequency || "once_per_session";

    if (freq === "every_visit") {
      return true;
    }

    if (freq === "once_per_session") {
      if (
        dismissedThisSessionVersion &&
        dismissedThisSessionVersion === version
      ) {
        return false;
      }
      return true;
    }

    if (freq === "once_per_day") {
      const rec = await getDismissedRecord();
      const today = toDayKey();

      const recVersion = rec?.version ? String(rec.version) : "";
      const recDay = rec?.day ? String(rec.day) : "";

      if (recVersion === version && recDay === today) {
        return false;
      }
      return true;
    }

    return true;
  }, [settings, version]);

  const markDismissed = useCallback(async () => {
    const freq = settings?.show_frequency || "once_per_session";

    if (freq === "every_visit") {
      return;
    }

    if (freq === "once_per_session") {
      dismissedThisSessionVersion = version;
      return;
    }

    if (freq === "once_per_day") {
      await setDismissedRecord({ version, day: toDayKey() });
    }
  }, [settings?.show_frequency, version]);

  const close = useCallback(async () => {
    setVisible(false);
    await markDismissed();
  }, [markDismissed]);

  const navigate = useCallback(async () => {
    const type = settings?.destination_type;
    const value = settings?.destination_value
      ? String(settings.destination_value)
      : "";

    try {
      if (type === "event") {
        if (value) {
          router.push({ pathname: "/events/detail", params: { id: value } });
        } else {
          router.push("/(tabs)/home");
        }
      } else if (type === "product") {
        if (value) {
          router.push({ pathname: "/product-detail", params: { id: value } });
        } else {
          router.push("/(tabs)/home");
        }
      } else {
        // page
        if (value && value.startsWith("/")) {
          router.push(value);
        } else {
          router.push("/(tabs)/home");
        }
      }
    } catch (e) {
      console.error("[PromoPopup] navigation failed", e);
    } finally {
      await close();
    }
  }, [close, router, settings?.destination_type, settings?.destination_value]);

  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      // Avoid re-deciding on every render.
      if (decisionMade) return;

      const show = await shouldShow();
      if (cancelled) return;

      setVisible(show);
      setDecisionMade(true);
    };

    decide();

    return () => {
      cancelled = true;
    };
  }, [decisionMade, shouldShow]);

  // Reset decision when promo changes version (so updated promos can show again)
  useEffect(() => {
    setDecisionMade(false);
  }, [version]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType={Platform.OS === "web" ? "none" : "fade"}
      onRequestClose={close}
    >
      <Pressable
        onPress={close}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Backdrop */}
        <BlurView
          intensity={Platform.OS === "web" ? 0 : 24}
          tint="dark"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />

        {/* Card */}
        <Pressable
          onPress={() => {}}
          style={{
            width: modalWidth,
            height: modalHeight,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: colors?.background || "#fff",
            borderWidth: 1,
            borderColor: colors?.separator || "rgba(255,255,255,0.12)",
          }}
        >
          {/* Close button */}
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 20,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "rgba(0,0,0,0.55)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <X size={18} color="#fff" />
          </Pressable>

          <Pressable onPress={navigate} style={{ flex: 1 }}>
            {imageSource?.uri ? (
              <Image
                source={imageSource}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={160}
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors?.text || "#111" }}>Promo</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
