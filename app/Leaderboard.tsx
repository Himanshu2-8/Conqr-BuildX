import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  fetchLeaderboard,
  type LeaderboardMetric,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "./services/leaderboard";

function formatMetricValue(metric: LeaderboardMetric, value: number): string {
  if (metric === "distance") return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value).toLocaleString()} m2`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getRankBadge(rank: number) {
  if (rank === 1) return { icon: "trophy", color: "#FACC15" };
  if (rank === 2) return { icon: "trophy", color: "#CBD5E1" };
  if (rank === 3) return { icon: "trophy", color: "#D97706" };
  return { icon: "medal-outline", color: "#9CA3AF" };
}

function GradientCard({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={["#1a0205", "#050505"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {children}
    </LinearGradient>
  );
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
    <Pressable
      style={({ pressed }) => [styles.toggleBtn, active && styles.toggleBtnActive, pressed && styles.pressed]}
      onPress={() => onSelect(value)}
    >
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
        contentContainerStyle={[styles.page, { paddingBottom: 30 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.h1}>Leaderboard</Text>
          <Text style={styles.sub}>
            Rank runners by {metricLabel.toLowerCase()} for this {period} window.
          </Text>
        </View>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="chart-bar" size={16} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Metric</Text>
          </View>

          <View style={styles.toggleRow}>
            <ToggleButton label="Area" value="area" selected={metric} onSelect={setMetric} />
            <ToggleButton label="Distance" value="distance" selected={metric} onSelect={setMetric} />
          </View>
        </GradientCard>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="timer-outline" size={16} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Period</Text>
          </View>

          <View style={styles.toggleRow}>
            <ToggleButton label="Daily" value="daily" selected={period} onSelect={setPeriod} />
            <ToggleButton label="Weekly" value="weekly" selected={period} onSelect={setPeriod} />
          </View>

          <Pressable style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]} onPress={load}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>

          {loading ? <Text style={styles.hint}>Loading rankings...</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && rows.length === 0 ? (
            <Text style={styles.hint}>No valid sessions in this period yet.</Text>
          ) : null}
        </GradientCard>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="trophy" size={18} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Results</Text>
          </View>

          <View style={{ gap: 10 }}>
            {rows.map((row, index) => {
              const topThree = index < 3;
              const badge = getRankBadge(row.rank);

              return (
                <View key={row.userId} style={[styles.row, topThree && styles.rowTop]}>
                  <View style={styles.rankWrap}>
                    <MaterialCommunityIcons name={badge.icon as any} size={16} color={badge.color} />
                  </View>

                  <View style={[styles.avatar, topThree && styles.avatarTop]}>
                    <Text style={styles.avatarText}>{getInitials(row.username)}</Text>
                  </View>

                  <View style={styles.rowMain}>
                    <Text style={styles.username} numberOfLines={1}>
                      {row.username}
                    </Text>
                    <Text style={styles.userId} numberOfLines={1}>
                      {row.userId.slice(0, 10)}
                    </Text>
                  </View>

                  <View style={styles.valueWrap}>
                    <Text style={[styles.value, topThree && styles.valueTop]}>{formatMetricValue(metric, row.value)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GradientCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  page: { padding: 16, gap: 14, maxWidth: 520, alignSelf: "center", width: "100%" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },

  header: { gap: 6, paddingBottom: 8 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },

  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(220, 38, 38, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  toggleBtnActive: {
    backgroundColor: "rgba(220, 38, 38, 0.20)",
    borderColor: "rgba(220, 38, 38, 0.55)",
  },
  toggleText: { color: "#E5E7EB", fontWeight: "700" },
  toggleTextActive: { color: "#FCA5A5" },

  refreshBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.55)",
  },
  refreshText: { color: "#fff", fontWeight: "900" },

  hint: { color: "#9CA3AF", fontSize: 12, marginTop: 10 },
  error: { color: "#FB7185", fontSize: 12, marginTop: 10 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  rowTop: {
    borderColor: "rgba(220, 38, 38, 0.55)",
    backgroundColor: "rgba(220, 38, 38, 0.12)",
  },

  rankWrap: { width: 40, alignItems: "center", justifyContent: "center" },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTop: { backgroundColor: "#DC2626" },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  username: { color: "#fff", fontWeight: "800", fontSize: 14 },
  userId: { color: "#9CA3AF", fontSize: 12 },

  valueWrap: { alignItems: "flex-end" },
  value: { color: "#E5E7EB", fontWeight: "900", fontSize: 12 },
  valueTop: { color: "#FCA5A5" },
});
