import React from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRunTracker } from "./hooks/useRunTracker";

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

export function RunScreen() {
  const { isRunning, elapsedSeconds, distanceMeters, paceMinPerKm, points, error, startRun, stopRun, resetRun } = useRunTracker();

  const onStart = async () => {
    await startRun();
  };

  const onStop = () => {
    stopRun();
    Alert.alert("Run stopped", `Captured ${points.length} points`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Run Tracker</Text>
          <Text style={styles.subtitle}>Track your pace and distance live.</Text>
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
        <View style={styles.actions}>
          {isRunning ? (
            <Pressable style={[styles.primaryButton, styles.stopButton]} onPress={onStop}>
              <Text style={styles.primaryButtonText}>Stop Run</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryButton} onPress={onStart}>
              <Text style={styles.primaryButtonText}>Start Run</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={resetRun}>
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
        </View>
      </View>
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
    padding: 20,
    gap: 20,
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
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
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
    fontSize: 26,
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
    marginTop: "auto",
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
});
