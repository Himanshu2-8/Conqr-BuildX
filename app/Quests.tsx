import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "./context/AuthContext";
import { fetchMissionsSummary, type MissionsSummary } from "./services/missions";

type QuestFilter = "all" | "daily" | "streak" | "zone";
type StatusFilter = "all" | "open" | "done";
type BadgeFilter = "all" | "unlocked" | "locked";

function FilterChip<T extends string>({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: T;
  selected: T;
  onSelect: (value: T) => void;
}) {
  const active = value === selected;
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(value)}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function QuestsScreen() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<MissionsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questFilter, setQuestFilter] = useState<QuestFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>("all");

  useEffect(() => {
    if (!user) {
      setMissions(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchMissionsSummary(user.uid)
      .then((data) => {
        if (active) {
          setMissions(data);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load missions";
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const visibleQuests = useMemo(() => {
    if (!missions) return [];
    return missions.quests.filter((q) => {
      if (questFilter === "daily" && q.id !== "daily_route") return false;
      if (questFilter === "streak" && q.id !== "streak_quest") return false;
      if (questFilter === "zone" && q.id !== "zone_challenge") return false;
      if (statusFilter === "done" && !q.completed) return false;
      if (statusFilter === "open" && q.completed) return false;
      return true;
    });
  }, [missions, questFilter, statusFilter]);

  const visibleBadges = useMemo(() => {
    if (!missions) return [];
    return missions.badges.filter((b) => {
      if (badgeFilter === "unlocked") return b.unlocked;
      if (badgeFilter === "locked") return !b.unlocked;
      return true;
    });
  }, [missions, badgeFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Quests</Text>
          <Text style={styles.subtitle}>Daily routes, streak quests, zone challenges, and badge unlocks.</Text>
        </View>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.sectionTitle}>Quest Filters</Text>
          <View style={styles.filterRow}>
            <FilterChip label="All" value="all" selected={questFilter} onSelect={setQuestFilter} />
            <FilterChip label="Daily" value="daily" selected={questFilter} onSelect={setQuestFilter} />
            <FilterChip label="Streak" value="streak" selected={questFilter} onSelect={setQuestFilter} />
            <FilterChip label="Zone" value="zone" selected={questFilter} onSelect={setQuestFilter} />
          </View>
          <View style={styles.filterRow}>
            <FilterChip label="Any" value="all" selected={statusFilter} onSelect={setStatusFilter} />
            <FilterChip label="Open" value="open" selected={statusFilter} onSelect={setStatusFilter} />
            <FilterChip label="Done" value="done" selected={statusFilter} onSelect={setStatusFilter} />
          </View>
        </LinearGradient>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.sectionTitle}>Quest Progress</Text>
          {loading ? <Text style={styles.hint}>Loading quests...</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && visibleQuests.length === 0 ? <Text style={styles.hint}>No quests for selected filters.</Text> : null}
          {visibleQuests.map((quest) => {
            const pct = quest.target > 0 ? Math.min((quest.progress / quest.target) * 100, 100) : 0;
            return (
              <View key={quest.id} style={styles.questItem}>
                <View style={styles.questHead}>
                  <Text style={styles.questTitle}>{quest.title}</Text>
                  <Text style={[styles.questState, quest.completed && styles.questStateDone]}>
                    {quest.completed ? "Done" : `${Math.round(pct)}%`}
                  </Text>
                </View>
                <Text style={styles.questDesc}>{quest.description}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
          {missions ? <Text style={styles.hint}>Current streak: {missions.streakDays} day(s)</Text> : null}
        </LinearGradient>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.sectionTitle}>Badge Filters</Text>
          <View style={styles.filterRow}>
            <FilterChip label="All" value="all" selected={badgeFilter} onSelect={setBadgeFilter} />
            <FilterChip label="Unlocked" value="unlocked" selected={badgeFilter} onSelect={setBadgeFilter} />
            <FilterChip label="Locked" value="locked" selected={badgeFilter} onSelect={setBadgeFilter} />
          </View>
          <View style={styles.badgesWrap}>
            {visibleBadges.map((badge) => (
              <View key={badge.id} style={[styles.badge, badge.unlocked && styles.badgeUnlocked]}>
                <Text style={[styles.badgeTitle, badge.unlocked && styles.badgeTitleUnlocked]}>{badge.title}</Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  page: { padding: 16, gap: 14, paddingBottom: 28 },
  header: { gap: 4 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 13 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    gap: 10,
  },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.45)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  chipActive: {
    borderColor: "rgba(220,38,38,0.70)",
    backgroundColor: "rgba(220,38,38,0.20)",
  },
  chipText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#FCA5A5" },
  hint: { color: "#9CA3AF", fontSize: 12 },
  error: { color: "#FB7185", fontSize: 12 },
  questItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 6,
  },
  questHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },
  questState: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  questStateDone: { color: "#86efac" },
  questDesc: { color: "#9CA3AF", fontSize: 12 },
  track: { height: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#DC2626", borderRadius: 999 },
  badgesWrap: { gap: 8 },
  badge: {
    borderWidth: 1,
    borderColor: "rgba(156,163,175,0.45)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.25)",
    gap: 2,
  },
  badgeUnlocked: {
    borderColor: "rgba(220,38,38,0.70)",
    backgroundColor: "rgba(220,38,38,0.20)",
  },
  badgeTitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" },
  badgeTitleUnlocked: { color: "#FCA5A5" },
  badgeDesc: { color: "#9CA3AF", fontSize: 11 },
});
