import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Phone, MapPin } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { apiFetch, getImageSource } from "../utils/apiFetch";

export default function LocateUs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Fetch branches
  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await apiFetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
  });

  const branches = data?.branches?.filter((b) => b.is_active) || [];

  const [imageProxyOverrides, setImageProxyOverrides] = React.useState({});

  const getBranchImageSource = (branch) => {
    const raw = branch?.image_url ? String(branch.image_url).trim() : "";
    const forceProxy = !!imageProxyOverrides?.[branch?.id];

    // iOS blocks plain http images (ATS). Also some hosts block hotlinking.
    const shouldProxyByDefault =
      Platform.OS !== "web" && raw && raw.toLowerCase().startsWith("http://");

    if (forceProxy || shouldProxyByDefault) {
      const proxiedPath = `/api/image-proxy?url=${encodeURIComponent(raw)}`;
      return getImageSource(proxiedPath);
    }

    return getImageSource(raw);
  };

  const handleBranchImageError = (branch) => {
    const raw = branch?.image_url ? String(branch.image_url).trim() : "";
    if (!raw) {
      return;
    }

    // Retry once via proxy
    setImageProxyOverrides((prev) => {
      if (prev?.[branch.id]) {
        return prev;
      }
      return { ...prev, [branch.id]: true };
    });
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return;

    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, "");

    // WhatsApp URL
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}`;

    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        } else {
          // Fallback to web WhatsApp
          const webUrl = `https://wa.me/${cleanPhone}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch((err) => console.error("Error opening WhatsApp:", err));
  };

  const handleMapLocation = (location, name) => {
    if (!location) return;

    // Try to open in native maps app
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });

    const latLng = `${location}`;
    const label = encodeURIComponent(name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latLng}`;
          return Linking.openURL(googleMapsUrl);
        }
      })
      .catch((err) => console.error("Error opening Maps:", err));
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            padding: 8,
            marginLeft: -8,
          }}
        >
          <ArrowLeft size={24} color="#000000" />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "600",
            color: "#000000",
            marginLeft: 12,
          }}
        >
          Locate Us
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : branches.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 32,
          }}
        >
          <MapPin size={48} color="#9CA3AF" />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#1F2937",
              marginTop: 16,
            }}
          >
            No Branches Available
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#6B7280",
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Check back later for branch locations
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {branches.map((branch, index) => (
            <View
              key={branch.id}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              {/* Branch Name */}
              <View style={{ padding: 16, backgroundColor: "#F9FAFB" }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: "#000000",
                  }}
                >
                  {branch.name}
                </Text>
              </View>

              {/* Branch Image */}
              {branch.image_url ? (
                <Image
                  source={getBranchImageSource(branch)}
                  style={{
                    width: "100%",
                    height: 200,
                    backgroundColor: "#F3F4F6",
                  }}
                  contentFit="cover"
                  transition={200}
                  onError={() => {
                    console.log(
                      "Image failed to load for branch:",
                      branch.name,
                    );
                    handleBranchImageError(branch);
                  }}
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: 200,
                    backgroundColor: "#F3F4F6",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <MapPin size={48} color="#9CA3AF" />
                  <Text
                    style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}
                  >
                    No image available
                  </Text>
                </View>
              )}

              {/* Branch Description */}
              <View style={{ padding: 16 }}>
                {branch.address && (
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#4B5563",
                        marginBottom: 4,
                      }}
                    >
                      Address
                    </Text>
                    <Text
                      style={{ fontSize: 14, color: "#6B7280", lineHeight: 20 }}
                    >
                      {branch.address}
                    </Text>
                  </View>
                )}

                {/* Divider */}
                {branch.address && (branch.phone || branch.location) && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#E5E7EB",
                      marginBottom: 16,
                    }}
                  />
                )}

                {/* Action Icons */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 24,
                    alignItems: "center",
                  }}
                >
                  {/* Phone/WhatsApp Icon */}
                  {branch.phone && (
                    <TouchableOpacity
                      onPress={() => handleWhatsApp(branch.phone)}
                      style={{
                        padding: 8,
                      }}
                    >
                      <Phone size={28} color="#25D366" />
                    </TouchableOpacity>
                  )}

                  {/* Map Location with Text */}
                  {branch.location && (
                    <TouchableOpacity
                      onPress={() =>
                        handleMapLocation(branch.location, branch.name)
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        padding: 8,
                      }}
                    >
                      <MapPin size={20} color="#25D366" />
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#25D366",
                        }}
                      >
                        Directions
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
