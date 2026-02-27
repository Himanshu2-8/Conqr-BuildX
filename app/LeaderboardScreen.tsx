import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchLeaderboard, type LeaderboardMetric, type LeaderboardPeriod, type LeaderboardRow } from "./services/leaderboard";

function formatMetricValue(metric: LeaderboardMetric, value: number): string {
  if (metric === "distance") {
    return `${(value / 1000).toFixed(2)} km`;
  }
  return `${Math.round(value).toLocaleString()} m²`;
}

type ToggleButtonProps<T extends string> = {
  label: string;
  value: T;
  selected: T;
  onSelect: (value: T) => void;
};

function ToggleButton<T extends string>({ label, value, selected, onSelect }: ToggleButtonProps<T>) {
  const active = value === selected;
  return (
    <Pressable style={[styles.toggleButton, active && styles.toggleButtonActive]} onPress={() => onSelect(value)}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [metric, setMetric] = useState<LeaderboardMetric>("area");
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metricLabel = useMemo(() => (metric === "area" ? "Total Area" : "Total Distance"), [metric]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const leaderboardRows = await fetchLeaderboard(metric, period);
      setRows(leaderboardRows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load leaderboard";
      setRows([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [metric, period]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 30 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Rank runners by {metricLabel.toLowerCase()} for this {period} window.</Text>
        </View>

        <View style={styles.toggleGroup}>
          <Text style={styles.toggleLabel}>Metric</Text>
          <View style={styles.toggleRow}>
            <ToggleButton label="Area" value="area" selected={metric} onSelect={setMetric} />
            <ToggleButton label="Distance" value="distance" selected={metric} onSelect={setMetric} />
          </View>
        </View>

        <View style={styles.toggleGroup}>
          <Text style={styles.toggleLabel}>Period</Text>
          <View style={styles.toggleRow}>
            <ToggleButton label="Daily" value="daily" selected={period} onSelect={setPeriod} />
            <ToggleButton label="Weekly" value="weekly" selected={period} onSelect={setPeriod} />
          </View>
        </View>

        <Pressable style={styles.refreshButton} onPress={load}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>

        {loading ? <Text style={styles.metaText}>Loading rankings...</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && rows.length === 0 ? (
          <Text style={styles.metaText}>No valid sessions in this period yet.</Text>
        ) : null}

        <View style={styles.list}>
          {rows.map((row, index) => {
            const topThree = index < 3;
            return (
              <View key={row.userId} style={[styles.row, topThree && styles.rowTop]}>
                <Text style={[styles.rank, topThree && styles.rankTop]}>#{row.rank}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.username}>{row.username}</Text>
                  <Text style={styles.userId}>{row.userId.slice(0, 8)}</Text>
                </View>
                <Text style={styles.value}>{formatMetricValue(metric, row.value)}</Text>
              </View>
            );
          })}
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
    padding: 20,
    gap: 14,
    flexGrow: 1,
  },
  header: {
    gap: 4,
    marginBottom: 4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  toggleGroup: {
    gap: 8,
  },
  toggleLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  toggleButtonActive: {
    borderColor: "#22c55e",
    backgroundColor: "#14532d",
  },
  toggleText: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#dcfce7",
  },
  refreshButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  refreshText: {
    color: "#dbeafe",
    fontWeight: "700",
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
  },
  list: {
    gap: 10,
    marginTop: 2,
  },
  row: {
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowTop: {
    borderColor: "#0ea5e9",
    backgroundColor: "#0f172a",
  },
  rank: {
    width: 40,
    color: "#cbd5e1",
    fontWeight: "800",
    fontSize: 16,
  },
  rankTop: {
    color: "#38bdf8",
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  username: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 15,
  },
  userId: {
    color: "#64748b",
    fontSize: 12,
  },
  value: {
    color: "#86efac",
    fontWeight: "700",
    fontSize: 14,
  },
});
