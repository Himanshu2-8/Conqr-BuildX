import React, { useEffect, useMemo, useRef } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
// @ts-ignore react-native-maps types are resolved at runtime in this Expo app
import MapView, { Polygon, Polyline, type Region } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FogOverlay } from "./components/FogOverlay";
import { PredictionModal } from "./components/PredictionModal";
import { useFogOfWar } from "./hooks/useFogOfWar";
import { useRunTracker } from "./hooks/useRunTracker";
import { useAuth } from "./context/AuthContext";
import { saveRunSession, type SaveRunResult, updateSessionClaimedArea } from "./services/runSessions";
import { subscribeAllTerritories, updateTerritoryForRun, type TerritoryState } from "./services/territory";
import { fetchMissionsSummary } from "./services/missions";
import {
  cancelPrediction,
  formatPredictionValue,
  getMetricLabel,
  resolvePrediction,
  type Prediction,
} from "./services/predictions";
import { useEntranceAnim } from "./hooks/useEntranceAnim";

function formatDuration(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatPace(paceMinPerKm: number | null) {
  if (!paceMinPerKm || !Number.isFinite(paceMinPerKm)) {
    return "--";
  }
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export function RunScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isRunning, elapsedSeconds, distanceMeters, paceMinPerKm, points, error, startRun, stopRun, resetRun } =
    useRunTracker();
  const [saving, setSaving] = React.useState(false);
  const [runStartedAtMs, setRunStartedAtMs] = React.useState<number | null>(null);
  const [lastSave, setLastSave] = React.useState<SaveRunResult | null>(null);
  const [territory, setTerritory] = React.useState<TerritoryState | null>(null);
  const [allTerritories, setAllTerritories] = React.useState<TerritoryState[]>([]);
  const [territoryLoading, setTerritoryLoading] = React.useState(false);
  const [mapRegion, setMapRegion] = React.useState<Region>(DEFAULT_REGION);
  const [currentLocation, setCurrentLocation] = React.useState<MapCoordinate | null>(null);
  const [mapLayout, setMapLayout] = React.useState({ width: 0, height: 0 });
  const [showPredictionModal, setShowPredictionModal] = React.useState(false);
  const [activePrediction, setActivePrediction] = React.useState<Prediction | null>(null);
  const [predictionResult, setPredictionResult] = React.useState<Prediction | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const pageAnim = useEntranceAnim(0, 16);
  const statsAnim = useEntranceAnim(200, 12);

  const routeCoordinates = useMemo(
    () => points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    [points]
  );

  // When not running and no active route, auto-fit to territories so the preview starts focused.
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    if (isRunning) {
      return;
    }
    if (routeCoordinates.length > 0) {
      return;
    }
    const territoryPoints = allTerritories.flatMap((t) => t.coordinates);
    if (territoryPoints.length < 2) {
      return;
    }
    mapRef.current.fitToCoordinates(territoryPoints, {
      edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
      animated: true,
    });
  }, [allTerritories, isRunning, routeCoordinates.length]);
  const territoryRevealPoints = useMemo(
    () => allTerritories.flatMap((shape) => shape.coordinates),
    [allTerritories]
  );
  const extraRevealPoints = useMemo(
    () =>
      currentLocation
        ? [currentLocation, ...routeCoordinates, ...territoryRevealPoints]
        : [...routeCoordinates, ...territoryRevealPoints],
    [currentLocation, routeCoordinates, territoryRevealPoints]
  );
  const { fogEnabled, exploredCount, loading: fogLoading, revealAroundPoints } = useFogOfWar(
    user?.uid ?? null,
    mapRegion,
    extraRevealPoints
  );

  useEffect(() => {
    if (!currentLocation) {
      return;
    }
    revealAroundPoints([currentLocation]);
  }, [currentLocation, revealAroundPoints]);

  useEffect(() => {
    if (!mapRef.current || routeCoordinates.length === 0) {
      return;
    }

    if (routeCoordinates.length === 1) {
      const coordinate = routeCoordinates[0];
      mapRef.current.animateToRegion(
        {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
      return;
    }

    mapRef.current.fitToCoordinates(routeCoordinates, {
      edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
      animated: true,
    });
  }, [routeCoordinates]);

  useEffect(() => {
    if (!user) {
      setTerritory(null);
      setAllTerritories([]);
      return;
    }
    setTerritoryLoading(true);
    const unsubscribe = subscribeAllTerritories(
      (rows) => {
        setAllTerritories(rows);
        setTerritory(rows.find((row) => row.userId === user.uid) ?? null);
        setTerritoryLoading(false);
      },
      () => {
        setTerritoryLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  const onStart = async () => {
    const started = await startRun();
    if (started) {
      setLastSave(null);
      setPredictionResult(null);
      setRunStartedAtMs(Date.now());
    }
  };

  const onStop = async () => {
    stopRun();
    const endedAtMs = Date.now();
    const startedAtMs = runStartedAtMs ?? endedAtMs - elapsedSeconds * 1000;

    if (!user) {
      Alert.alert("Session not saved", "No authenticated user found.");
      return;
    }

    setSaving(true);
    try {
      let beforeCompleted = new Set<string>();
      try {
        const beforeSummary = await fetchMissionsSummary(user.uid);
        beforeCompleted = new Set(beforeSummary.quests.filter((quest) => quest.completed).map((quest) => quest.id));
      } catch {
        beforeCompleted = new Set<string>();
      }
      const result = await saveRunSession({
        userId: user.uid,
        startedAtMs,
        endedAtMs,
        elapsedSeconds,
        distanceMeters,
        paceMinPerKm,
        points,
      });
      setLastSave(result);
      if (result.isValid) {
        const previousAreaM2 = territory?.areaM2 ?? 0;
        const updatedTerritory = await updateTerritoryForRun(user.uid, points);
        if (updatedTerritory) {
          setTerritory(updatedTerritory);
          const claimedAreaDeltaM2 = Math.max(updatedTerritory.areaM2 - previousAreaM2, 0);
          await updateSessionClaimedArea(result.sessionId, claimedAreaDeltaM2);
        }

        // ── Evaluate prediction ──────────────────────────────────────
        if (activePrediction) {
          try {
            const resolved = await resolvePrediction(activePrediction.id, result.sessionId, {
              distanceM: distanceMeters,
              paceMinPerKm: paceMinPerKm,
              areaM2: updatedTerritory?.areaM2 ?? 0,
            });
            setPredictionResult(resolved);
            setActivePrediction(null);
          } catch {
            // Non-critical – prediction just stays unresolved
          }
        }
      }
      let unlockedNow: { title: string }[] = [];
      try {
        const afterSummary = await fetchMissionsSummary(user.uid);
        unlockedNow = afterSummary.quests.filter((quest) => quest.completed && !beforeCompleted.has(quest.id));
      } catch {
        unlockedNow = [];
      }
      const unlockedLine =
        unlockedNow.length > 0 ? `\nMission unlocked: ${unlockedNow.map((quest) => quest.title).join(", ")}` : "";
      const predLine = predictionResult
        ? `\n${predictionResult.status === "hit"
            ? `⚡ Prediction HIT! +${Math.round(predictionResult.bonusAreaM2).toLocaleString()} m² bonus`
            : `Prediction missed. −${Math.round(predictionResult.stakeAreaM2).toLocaleString()} m² territory`}`
        : "";
      Alert.alert(
        "Run saved",
        result.isValid
          ? `Session ${result.sessionId} saved.${unlockedLine}${predLine}`
          : `Saved as invalid: ${result.invalidReason ?? "Unknown reason"}`
      );
    } catch (saveErr: unknown) {
      const message = saveErr instanceof Error ? saveErr.message : "Failed to save run";
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        style={[styles.container, pageAnim]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            hitSlop={12}
            android_ripple={{ color: "rgba(255,255,255,0.10)" }}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Live Run</Text>
          <View style={styles.backSpacer} />
        </View>
        <Text style={styles.subtitle}>Live location + active route + post-run route.</Text>

        <View style={styles.mapCard}>
          <View
            style={styles.mapViewport}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setMapLayout({ width, height });
            }}
          >
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={DEFAULT_REGION}
              onRegionChangeComplete={setMapRegion}
              onUserLocationChange={(event) => {
                const nextLocation = event.nativeEvent.coordinate;
                if (!nextLocation) {
                  return;
                }
                setCurrentLocation({
                  latitude: nextLocation.latitude,
                  longitude: nextLocation.longitude,
                });
              }}
            >
              {allTerritories.map((shape, index) => {
                const isOwn = !!user && shape.userId === user.uid;
                return (
                  <Polygon
                    key={`${shape.userId ?? "unknown"}-${index}`}
                    coordinates={shape.coordinates}
                    fillColor={isOwn ? "rgba(220,38,38,0.26)" : "rgba(156,163,175,0.18)"}
                    strokeColor={isOwn ? "#DC2626" : "#9CA3AF"}
                    strokeWidth={isOwn ? 2 : 1}
                  />
                );
              })}
              {routeCoordinates.length >= 2 ? (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={isRunning ? "#EF4444" : "#FCA5A5"}
                  strokeWidth={5}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : null}
            </MapView>
            {fogEnabled ? (
              <FogOverlay
                width={mapLayout.width}
                height={mapLayout.height}
                region={mapRegion}
                revealPolygons={allTerritories.map((shape) => shape.coordinates)}
              />
            ) : null}
            <Pressable
              onPress={() => navigation.navigate("MapPop")}
              hitSlop={10}
              style={({ pressed }) => [styles.mapExpandBtn, pressed && styles.pressed]}
            >
              <Text style={styles.mapExpandIcon}>⤢</Text>
            </Pressable>
          </View>
          <Text style={styles.mapCaption}>
            {isRunning ? "Current run polyline is updating live." : "Last route remains visible after finishing."}
          </Text>
          <Text style={styles.mapCaption}>
            {`Fog-of-war active. ${exploredCount} tiles revealed${fogLoading ? "..." : "."}`}
          </Text>
          <Text style={styles.mapCaption}>
            {currentLocation ? "Current location visible." : "Waiting for current location..."}
          </Text>
        </View>

        <Animated.View style={[styles.statsGrid, statsAnim]}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{(distanceMeters / 1000).toFixed(2)} km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pace</Text>
            <Text style={styles.statValue}>{formatPace(paceMinPerKm)}</Text>
          </View>
        </Animated.View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>GPS points</Text>
          <Text style={styles.metaValue}>{points.length}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {territoryLoading ? <Text style={styles.metaText}>Loading territory...</Text> : null}
        {territory ? (
          <View style={styles.territoryCard}>
            <Text style={styles.territoryTitle}>Territory</Text>
            <Text style={styles.territoryText}>{Math.round(territory.areaM2).toLocaleString()} m² claimed</Text>
          </View>
        ) : null}

        {/* ── Active Prediction Card ──────────────────────────── */}
        {activePrediction && (
          <View style={styles.predictionCard}>
            <View style={styles.predictionHeader}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FBBF24" />
              <Text style={styles.predictionTitle}>Active Prediction</Text>
            </View>
            <Text style={styles.predictionMetric}>
              {getMetricLabel(activePrediction.metric)}: {formatPredictionValue(activePrediction.metric, activePrediction.targetValue)}
            </Text>
            <View style={styles.predictionStakes}>
              <Text style={styles.stakeRisk}>⚠ At risk: {Math.round(activePrediction.stakeAreaM2).toLocaleString()} m²</Text>
              <Text style={styles.stakeBonus}>✦ Bonus: +{Math.round(activePrediction.bonusAreaM2).toLocaleString()} m²</Text>
            </View>
            {!isRunning && (
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [styles.cancelPredBtn, pressed && styles.pressed]}
                onPress={async () => {
                  try {
                    await cancelPrediction(activePrediction.id);
                    setActivePrediction(null);
                  } catch {}
                }}
              >
                <Text style={styles.cancelPredText}>Cancel Prediction</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Prediction Result Card ─────────────────────────── */}
        {predictionResult && (
          <View style={[
            styles.predictionCard,
            predictionResult.status === "hit" ? styles.predictionHit : styles.predictionMiss,
          ]}>
            <View style={styles.predictionHeader}>
              <MaterialCommunityIcons
                name={predictionResult.status === "hit" ? "check-circle" : "close-circle"}
                size={20}
                color={predictionResult.status === "hit" ? "#34D399" : "#FB7185"}
              />
              <Text style={[
                styles.predictionTitle,
                { color: predictionResult.status === "hit" ? "#34D399" : "#FB7185" },
              ]}>
                Prediction {predictionResult.status === "hit" ? "HIT!" : "Missed"}
              </Text>
            </View>
            <Text style={styles.predictionMetric}>
              Target: {formatPredictionValue(predictionResult.metric, predictionResult.targetValue)}
              {"  →  "}
              Actual: {predictionResult.actualValue != null
                ? formatPredictionValue(predictionResult.metric, predictionResult.actualValue)
                : "--"}
            </Text>
            <Text style={{
              color: predictionResult.status === "hit" ? "#34D399" : "#FB7185",
              fontSize: 13,
              fontWeight: "600",
              marginTop: 4,
            }}>
              {predictionResult.status === "hit"
                ? `+${Math.round(predictionResult.bonusAreaM2).toLocaleString()} m² bonus territory!`
                : `-${Math.round(predictionResult.stakeAreaM2).toLocaleString()} m² territory lost`}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {isRunning ? (
            <Pressable
              android_ripple={{ color: "rgba(255,255,255,0.12)" }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.primaryButton,
                styles.stopButton,
                pressed && styles.pressed,
                saving && styles.disabledButton,
              ]}
              onPress={onStop}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>Stop Run</Text>
            </Pressable>
          ) : (
            <>
              {!activePrediction && (
                <Pressable
                  android_ripple={{ color: "rgba(255,255,255,0.10)" }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.predictionButton, pressed && styles.pressed]}
                  onPress={() => setShowPredictionModal(true)}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FBBF24" />
                  <Text style={styles.predictionButtonText}>Make a Prediction</Text>
                </Pressable>
              )}
              <Pressable
                android_ripple={{ color: "rgba(255,255,255,0.12)" }}
                hitSlop={8}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabledButton]}
                onPress={onStart}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>Start Run</Text>
              </Pressable>
            </>
          )}
          <Pressable
            android_ripple={{ color: "rgba(255,255,255,0.10)" }}
            hitSlop={8}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, saving && styles.disabledButton]}
            onPress={resetRun}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          {saving ? <Text style={styles.metaText}>Saving session...</Text> : null}
          {lastSave ? (
            <View style={styles.saveCard}>
              <Text style={styles.saveTitle}>Last Save</Text>
              <Text style={styles.saveText}>Session: {lastSave.sessionId}</Text>
              <Text style={styles.saveText}>Valid: {lastSave.isValid ? "Yes" : "No"}</Text>
              {lastSave.invalidReason ? <Text style={styles.saveText}>Reason: {lastSave.invalidReason}</Text> : null}
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <PredictionModal
        visible={showPredictionModal}
        onClose={() => setShowPredictionModal(false)}
        currentTerritoryM2={territory?.areaM2 ?? 0}
        onPredictionCreated={(prediction) => {
          setActivePrediction(prediction);
          setShowPredictionModal(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topTitle: { color: "#ffffff", fontSize: 22, fontWeight: "900" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(220, 38, 38, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { color: "#ffffff", fontSize: 28, fontWeight: "900", marginTop: -2 },
  backSpacer: { width: 40, height: 40 },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  mapCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  mapViewport: {
    width: "100%",
    height: 320,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    height: "100%",
    width: "100%",
  },
  mapExpandBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  mapExpandIcon: { color: "#fff", fontSize: 16, fontWeight: "900" },
  mapCaption: {
    color: "#9CA3AF",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsGrid: {
    gap: 10,
  },
  statCard: {
    backgroundColor: "rgba(69, 10, 10, 0.22)",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
  },
  metaText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  metaValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#FB7185",
    fontSize: 13,
    textAlign: "center",
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  stopButton: {
    backgroundColor: "#B91C1C",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.45)",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  secondaryButtonText: {
    color: "#FCA5A5",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveCard: {
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  saveTitle: {
    color: "#ffffff",
    fontWeight: "700",
  },
  saveText: {
    color: "#E5E7EB",
    fontSize: 13,
  },
  territoryCard: {
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  territoryTitle: {
    color: "#ffffff",
    fontWeight: "700",
  },
  territoryText: {
    color: "#FCA5A5",
    fontSize: 13,
  },
  // ── Prediction styles ──────────────────────────────────────
  predictionCard: {
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    backgroundColor: "rgba(251,191,36,0.08)",
  },
  predictionHit: {
    borderColor: "rgba(52,211,153,0.40)",
    backgroundColor: "rgba(52,211,153,0.08)",
  },
  predictionMiss: {
    borderColor: "rgba(251,113,133,0.40)",
    backgroundColor: "rgba(251,113,133,0.08)",
  },
  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  predictionTitle: {
    color: "#FBBF24",
    fontWeight: "700",
    fontSize: 14,
  },
  predictionMetric: {
    color: "#E5E7EB",
    fontSize: 13,
  },
  predictionStakes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  stakeRisk: {
    color: "#FB7185",
    fontSize: 12,
    fontWeight: "600",
  },
  stakeBonus: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "600",
  },
  cancelPredBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.40)",
    backgroundColor: "rgba(251,113,133,0.08)",
  },
  cancelPredText: {
    color: "#FB7185",
    fontSize: 12,
    fontWeight: "600",
  },
  predictionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.10)",
  },
  predictionButtonText: {
    color: "#FBBF24",
    fontSize: 15,
    fontWeight: "700",
  },
});
