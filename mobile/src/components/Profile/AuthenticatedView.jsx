import React from "react";
import { View, ScrollView, TouchableOpacity, Text, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Gift,
  Star,
  LogOut,
  Edit,
  Trash2,
  Menu,
  Bell,
  HelpCircle,
  ChevronRight,
  Leaf,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { phoneAuth } from "../../utils/auth/phoneAuth";
import { useBranchStore } from "../../utils/branchStore";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../utils/apiFetch";

export default function AuthenticatedView({
  user,
  addresses,
  colors,
  statusBarStyle,
  insets,
  onSignOut,
  onMenuPress,
  onScroll,
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearBranch } = useBranchStore();
  const defaultAddress =
    addresses?.find((addr) => addr.is_default) || addresses?.[0];

  const [isEmployee, setIsEmployee] = React.useState(false);
  const [isClockedIn, setIsClockedIn] = React.useState(false);
  const [activeLog, setActiveLog] = React.useState(null);
  const [employee, setEmployee] = React.useState(null);
  const [punchActionLoading, setPunchActionLoading] = React.useState(false);

  const fetchPunchStatus = async () => {
    try {
      const res = await apiFetch("/api/employee/status");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.isEmployee) {
          setIsEmployee(true);
          setIsClockedIn(data.isClockedIn);
          setActiveLog(data.activeLog);
          setEmployee(data.employee);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch employee status:", e);
    }
  };

  React.useEffect(() => {
    fetchPunchStatus();
  }, [user]);

  const handlePunch = async () => {
    if (!employee) return;
    setPunchActionLoading(true);
    try {
      let latitude = null;
      let longitude = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords) {
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;
          }
        } else {
          Alert.alert("Access Denied", "Location verification Failed. Permission to access location was denied.");
          setPunchActionLoading(false);
          return;
        }
      } catch (locErr) {
        console.warn("GPS lookup failed:", locErr);
        Alert.alert("Access Denied", "Location verification Failed. Could not retrieve your GPS coordinates.");
        setPunchActionLoading(false);
        return;
      }

      if (isClockedIn) {
        // Clock Out
        const response = await apiFetch("/api/employee/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "out", notes: "", latitude, longitude })
        });
        const resData = await response.json().catch(() => ({}));
        if (response.ok && resData.success) {
          Alert.alert("Success", "Clocked out successfully!");
          await fetchPunchStatus();
        } else {
          Alert.alert("Access Denied", resData.error || "Location verification Failed");
        }
      } else {
        // Clock In
        const response = await apiFetch("/api/employee/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "in", notes: "", branch: employee.branch || "Badaro", latitude, longitude })
        });
        const resData = await response.json().catch(() => ({}));
        if (response.ok && resData.success) {
          Alert.alert("Success", "Clocked in successfully!");
          await fetchPunchStatus();
        } else {
          Alert.alert("Access Denied", resData.error || "Location verification Failed");
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "An unexpected error occurred during punch.");
    } finally {
      setPunchActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    await Haptics.selectionAsync();

    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This will permanently delete all your personal data including your name, phone number, birthday, addresses, and favorites. Your order history will be anonymized but preserved for business records. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              console.log(
                "[DELETE ACCOUNT] ========== DELETING ACCOUNT ==========",
              );

              // Delete account (this also clears auth storage)
              await phoneAuth.deleteAccount();

              // Clear branch selection
              await clearBranch();
              console.log("[DELETE ACCOUNT] Branch selection cleared");

              // Clear all query caches
              queryClient.clear();
              console.log("[DELETE ACCOUNT] Query cache cleared");

              console.log(
                "[DELETE ACCOUNT] ========== DELETION COMPLETE ==========",
              );

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );

              // Show success message before redirecting
              Alert.alert(
                "Account Deleted",
                "Your account has been successfully deleted. All your personal data has been removed.",
                [
                  {
                    text: "OK",
                    onPress: () => router.replace("/signup"),
                  },
                ],
              );
            } catch (error) {
              console.error("[DELETE ACCOUNT] Error:", error);
              const errorMessage = error.message || "Failed to delete account";
              const errorDetails = error.details
                ? `\n\nDetails: ${error.details}`
                : "";

              Alert.alert(
                "Error Deleting Account",
                `${errorMessage}${errorDetails}\n\nPlease try again or contact support if this issue persists.`,
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      await Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Error,
                      );
                    },
                  },
                ],
              );
            }
          },
        },
      ],
    );
  };

  const handleNotificationSettings = () => {
    router.push("/notification-settings");
  };

  const handleContactSupport = () => {
    router.push("/contact-support");
  };

  const formatBirthday = (birthday) => {
    if (!birthday) return "Not set";
    const date = new Date(birthday);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case "Gold":
        return "#F59E0B";
      case "Silver":
        return "#9CA3AF";
      case "Bronze":
        return "#CD7F32";
      default:
        return colors.textSecondary;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Header with Menu Button */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingHorizontal: 24,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <TouchableOpacity
          onPress={async () => {
            await Haptics.selectionAsync();
            onMenuPress();
          }}
          style={{
            padding: 8,
            alignSelf: "flex-start",
          }}
        >
          <Menu size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 120, // increased padding to clear bottom navigation bar
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Profile Header */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: colors.surface,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <User size={48} color={colors.primary} />
          </View>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 28,
              color: colors.text,
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            {user?.first_name} {user?.last_name}
          </Text>
          {user?.membership_tier && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <Star size={16} color={getTierColor(user.membership_tier)} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: getTierColor(user.membership_tier),
                }}
              >
                {user.membership_tier} Member
              </Text>
            </View>
          )}
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          onPress={() => router.push("/edit-profile")}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <Edit size={20} color="white" />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "white",
            }}
          >
            Edit Profile
          </Text>
        </TouchableOpacity>

        {/* Contact Information */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: colors.text,
              marginBottom: 16,
            }}
          >
            Contact Information
          </Text>
          {user?.email && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <Mail size={20} color={colors.textSecondary} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 16,
                  color: colors.text,
                  flex: 1,
                }}
              >
                {user.email}
              </Text>
            </View>
          )}
          {user?.phone && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Phone size={20} color={colors.textSecondary} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 16,
                  color: colors.text,
                  flex: 1,
                }}
              >
                {user.phone}
              </Text>
            </View>
          )}
        </View>

        {/* Delivery Address */}
        {defaultAddress && (
          <TouchableOpacity
            onPress={() => router.push("/manage-addresses")}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <MapPin size={20} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 16,
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  Delivery Address
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                    lineHeight: 20,
                  }}
                >
                  {defaultAddress.address_line1}
                  {defaultAddress.building
                    ? `, ${defaultAddress.building}`
                    : ""}
                  {"\n"}
                  {defaultAddress.city}
                  {defaultAddress.zip_code
                    ? `, ${defaultAddress.zip_code}`
                    : ""}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Account Details */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: colors.text,
              marginBottom: 16,
            }}
          >
            Account Details
          </Text>
          {user?.birthday && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <Calendar size={20} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                  }}
                >
                  Birthday
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {formatBirthday(user.birthday)}
                </Text>
              </View>
            </View>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Gift size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.textSecondary,
                }}
              >
                Loyalty Points
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                {user?.points || 0} points
              </Text>
            </View>
          </View>
        </View>

        {/* Notification Settings */}
        <TouchableOpacity
          onPress={handleNotificationSettings}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Bell size={20} color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: colors.text,
              }}
            >
              Notification Settings
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Contact Support */}
        <TouchableOpacity
          onPress={handleContactSupport}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <HelpCircle size={20} color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: colors.text,
              }}
            >
              Contact Support
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Sign Out & Punch row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4, width: '100%' }}>
          {isEmployee ? (
            <>
              <TouchableOpacity
                onPress={handlePunch}
                disabled={punchActionLoading}
                style={{
                  flex: 1,
                  height: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isClockedIn ? "#EF4444" : "#10B981",
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 16,
                    color: "white",
                    fontWeight: "bold"
                  }}
                >
                  {isClockedIn ? "Out" : "In"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSignOut}
                style={{
                  width: 50,
                  height: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                }}
              >
                <LogOut size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={onSignOut}
              style={{
                flex: 1,
                height: 50,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
                borderRadius: 12,
              }}
            >
              <LogOut size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* Delete Account Button */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: "#FEE2E2",
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 12,
            marginTop: 16,
          }}
        >
          <Trash2 size={18} color="#DC2626" />
          <Text
            style={{
              color: "#DC2626",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Delete Account
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
