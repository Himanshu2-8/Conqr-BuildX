import React from "react";
import { Alert, Button, Text, View } from "react-native";
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
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", textAlign: "center" }}>Run Tracker</Text>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 16 }}>Time</Text>
        <Text style={{ fontSize: 32, fontWeight: "700" }}>{formatDuration(elapsedSeconds)}</Text>
      </View>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 16 }}>Distance</Text>
        <Text style={{ fontSize: 28, fontWeight: "700" }}>{(distanceMeters / 1000).toFixed(2)} km</Text>
      </View>
      <View style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 16 }}>Pace</Text>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>{formatPace(paceMinPerKm)}</Text>
      </View>
      <Text style={{ textAlign: "center" }}>GPS points: {points.length}</Text>
      {error ? <Text style={{ color: "red", textAlign: "center" }}>{error}</Text> : null}

      {isRunning ? (
        <Button title="Stop Run" onPress={onStop} />
      ) : (
        <Button title="Start Run" onPress={onStart} />
      )}
      <Button title="Reset" onPress={resetRun} />
    </View>
  );
}
