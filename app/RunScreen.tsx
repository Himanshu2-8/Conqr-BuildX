import React, { useEffect, useMemo, useRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// @ts-ignore – react-native-maps is not installed in this workspace
import MapView, { Polygon, Polyline, type Region } from "react-native-maps";
import { useRunTracker } from "./hooks/useRunTracker";
import { useAuth } from "./context/AuthContext";
import { saveRunSession, type SaveRunResult, updateSessionClaimedArea } from "./services/runSessions";
import { fetchAllTerritories, fetchTerritory, updateTerritoryForRun, type TerritoryState } from "./services/territory";

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

export function RunScreen() {
  const { user } = useAuth();
  const { isRunning, elapsedSeconds, distanceMeters, paceMinPerKm, points, error, startRun, stopRun, resetRun } =
    useRunTracker();
  const [saving, setSaving] = React.useState(false);
  const [runStartedAtMs, setRunStartedAtMs] = React.useState<number | null>(null);
  const [lastSave, setLastSave] = React.useState<SaveRunResult | null>(null);
  const [territory, setTerritory] = React.useState<TerritoryState | null>(null);
  const [allTerritories, setAllTerritories] = React.useState<TerritoryState[]>([]);
  const [territoryLoading, setTerritoryLoading] = React.useState(false);
  const mapRef = useRef<MapView | null>(null);

  const routeCoordinates = useMemo(
    () => points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    [points]
  );

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
      return;
    }
    let isActive = true;
    setTerritoryLoading(true);
    fetchTerritory(user.uid)
      .then((data) => {
        if (isActive) {
          setTerritory(data);
        }
      })
      .then(async () => {
        const all = await fetchAllTerritories();
        if (isActive) {
          setAllTerritories(all);
        }
      })
      .finally(() => {
        if (isActive) {
          setTerritoryLoading(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [user]);

  const onStart = async () => {
    const started = await startRun();
    if (started) {
      setLastSave(null);
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
          const refreshedTerritories = await fetchAllTerritories();
          setAllTerritories(refreshedTerritories);
        }
      }
      Alert.alert(
        "Run saved",
        result.isValid
          ? `Session ${result.sessionId} saved.`
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Run Tracker</Text>
          <Text style={styles.subtitle}>Live location + active route + post-run route.</Text>
        </View>

        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            showsUserLocation
            followsUserLocation
            showsMyLocationButton
          >
            {allTerritories.map((shape, index) => {
              const isOwn = !!user && shape.userId === user.uid;
              return (
                <Polygon
                  key={`${shape.userId ?? "unknown"}-${index}`}
                  coordinates={shape.coordinates}
                  fillColor={isOwn ? "rgba(56,189,248,0.25)" : "rgba(251,191,36,0.18)"}
                  strokeColor={isOwn ? "#38bdf8" : "#f59e0b"}
                  strokeWidth={isOwn ? 2 : 1}
                />
              );
            })}
            {routeCoordinates.length >= 2 ? (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={isRunning ? "#22c55e" : "#38bdf8"}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            ) : null}
          </MapView>
          <Text style={styles.mapCaption}>
            {isRunning ? "Current run polyline is updating live." : "Last route remains visible after finishing."}
          </Text>
        </View>

        <View style={styles.statsGrid}>
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
        </View>

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

        <View style={styles.actions}>
          {isRunning ? (
            <Pressable style={[styles.primaryButton, styles.stopButton, saving && styles.disabledButton]} onPress={onStop} disabled={saving}>
              <Text style={styles.primaryButtonText}>Stop Run</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.primaryButton, saving && styles.disabledButton]} onPress={onStart} disabled={saving}>
              <Text style={styles.primaryButtonText}>Start Run</Text>
            </Pressable>
          )}
          <Pressable style={[styles.secondaryButton, saving && styles.disabledButton]} onPress={resetRun} disabled={saving}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 16,
    paddingBottom: 24,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  mapCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0f172a",
  },
  map: {
    height: 240,
    width: "100%",
  },
  mapCaption: {
    color: "#94a3b8",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsGrid: {
    gap: 10,
  },
  statCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  metaValue: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center",
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#22c55e",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
  primaryButtonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveCard: {
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: "#0f172a",
  },
  saveTitle: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  saveText: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  territoryCard: {
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: "#111827",
  },
  territoryTitle: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  territoryText: {
    color: "#bae6fd",
    fontSize: 13,
  },
});
