import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Zap, ZapOff, Camera, AlertCircle, RefreshCw } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../utils/apiFetch";
import { useTheme } from "../utils/theme";

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  
  const cameraRef = useRef(null);

  // Trigger permission request on mount if not determined
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isAnalyzing) return;
    
    try {
      setIsCapturing(true);
      setError(null);
      
      // Vibrate on capture
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        throw new Error("Failed to capture image path");
      }

      setIsAnalyzing(true);

      // Compress and resize the captured photo
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Read image as base64 string
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to backend
      const response = await apiFetch("/api/nutrition/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64,
          mimeType: "image/jpeg",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze image (Status: ${response.status})`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysisResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error("[Scanner] Error during capture/analysis:", err);
      setError(err.message || "An unexpected error occurred during analysis.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsCapturing(false);
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#2D5F3F" />
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.permissionContent}>
          <AlertCircle size={64} color="#F97316" style={{ marginBottom: 16 }} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera Permission Required</Text>
          <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
            Neo needs access to your camera to scan your plate and display nutrition facts.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plate Scanner</Text>
        {analysisResult ? (
          <View style={{ width: 40 }} />
        ) : (
          <TouchableOpacity style={styles.headerBtn} onPress={() => setFlash(!flash)}>
            {flash ? <Zap size={22} color="#F97316" /> : <ZapOff size={22} color="#ffffff" />}
          </TouchableOpacity>
        )}
      </View>

      {analysisResult ? (
        // Results View
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
            <Text style={[styles.wellnessTitle, { color: colors.text }]}>Your Wellness Plate</Text>
            <View style={styles.wellnessDivider} />
            
            {/* Stats block */}
            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={[styles.statText, { color: colors.text }]}>{analysisResult.calories} kcal</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statEmoji}>💪</Text>
                <Text style={[styles.statText, { color: colors.text }]}>Protein: {analysisResult.protein_g}g</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statEmoji}>🌾</Text>
                <Text style={[styles.statText, { color: colors.text }]}>Carbs: {analysisResult.carbs_g}g</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statEmoji}>🥑</Text>
                <Text style={[styles.statText, { color: colors.text }]}>Fat: {analysisResult.fat_g}g</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statEmoji}>🌱</Text>
                <Text style={[styles.statText, { color: colors.text }]}>Fiber: {analysisResult.fiber_g || 0}g</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statEmoji}>⭐</Text>
                <Text style={[styles.statText, { color: colors.text }]}>Wellness Score: {analysisResult.wellness_score || 0}/100</Text>
              </View>
            </View>

            {/* Ingredients Section */}
            {analysisResult.ingredients && analysisResult.ingredients.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ingredients Detected</Text>
                <View style={styles.ingredientsListVertical}>
                  {analysisResult.ingredients.map((ing, idx) => (
                    <View key={idx} style={styles.ingredientRow}>
                      <View style={styles.ingredientBullet} />
                      <Text style={[styles.ingredientText, { color: colors.text }]}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Description Summary Callout Box */}
            {analysisResult.description && (
              <View style={[styles.descriptionBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.descriptionText, { color: colors.text }]}>{analysisResult.description}</Text>
              </View>
            )}

            {/* Confidence indicator */}
            <View style={styles.confidenceRow}>
              <Text style={[styles.confidenceLabel, { color: colors.textSecondary }]}>AI Estimate Confidence:</Text>
              <Text style={[styles.confidenceVal, { color: (analysisResult.confidence || 0.95) > 0.8 ? '#10b981' : '#f59e0b' }]}>
                {Math.round((analysisResult.confidence || 0.95) * 100)}%
              </Text>
            </View>

            {/* Scan Another Button */}
            <TouchableOpacity style={styles.scanAgainBtn} onPress={handleReset}>
              <RefreshCw size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.scanAgainText}>Scan Another Plate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        // Camera View (Capture Mode)
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            enableTorch={flash}
          >
            {/* Viewfinder overlay */}
            <View style={styles.overlay}>
              <Text style={styles.scanInstruction}>Center food plate inside this area</Text>
              <View style={styles.viewFinder} />
            </View>
          </CameraView>

          {/* Action Overlay */}
          <View style={styles.actionOverlay}>
            {error && (
              <View style={styles.errorBanner}>
                <AlertCircle size={18} color="#ef4444" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {isAnalyzing || isCapturing ? (
              <View style={styles.analyzingCard}>
                <ActivityIndicator size="large" color="#F97316" style={{ marginBottom: 12 }} />
                <Text style={styles.analyzingText}>Analyzing Plate Nutrition...</Text>
              </View>
            ) : (
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={[styles.captureButton, { backgroundColor: '#F97316' }]}
                  onPress={handleCapture}
                >
                  <Camera size={32} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wellnessTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    marginBottom: 6,
  },
  wellnessDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    marginBottom: 20,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statEmoji: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: "center",
  },
  statText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  ingredientsListVertical: {
    marginTop: 8,
    gap: 8,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2D5F3F",
    marginRight: 12,
  },
  ingredientText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  descriptionBox: {
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#2D5F3F",
  },
  descriptionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },

  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionContainer: {
    flex: 1,
  },
  backBtn: {
    padding: 16,
    width: 56,
  },
  permissionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  permissionDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#2D5F3F",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1c1c1e",
  },
  headerBtn: {
    padding: 8,
    width: 44,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#ffffff",
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  scanInstruction: {
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    fontSize: 14,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 20,
  },
  viewFinder: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 24,
    borderStyle: "dashed",
  },
  actionOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#991b1b",
    flex: 1,
  },
  analyzingCard: {
    backgroundColor: "rgba(28, 28, 30, 0.95)",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  analyzingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  foodName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    marginBottom: 6,
  },
  foodDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  fdaLabel: {
    borderWidth: 1,
    borderColor: "#000000",
    padding: 12,
    backgroundColor: "#ffffff",
    marginBottom: 20,
  },
  fdaTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 28,
    textAlign: "center",
    color: "#000000",
  },
  fdaSectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#000000",
    marginTop: 4,
    marginBottom: 2,
  },
  fdaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  fdaLabelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#000000",
  },
  fdaValueText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#000000",
  },
  fdaCaloriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 4,
  },
  fdaCaloriesTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: "#000000",
  },
  fdaCaloriesValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
    color: "#000000",
  },
  fdaDividerThick: {
    height: 8,
    backgroundColor: "#000000",
    marginVertical: 4,
  },
  fdaDividerMedium: {
    height: 4,
    backgroundColor: "#000000",
    marginVertical: 4,
  },
  fdaDividerThin: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 6,
  },
  macroRow: {
    paddingVertical: 4,
  },
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  macroLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#000000",
  },
  macroValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#000000",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    marginBottom: 10,
  },
  ingredientsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ingBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 6,
  },
  confidenceLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  confidenceVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  scanAgainBtn: {
    backgroundColor: "#2D5F3F",
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scanAgainText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
  },
});
