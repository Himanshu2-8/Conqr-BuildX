import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MapView, { Polygon, type Region } from "react-native-maps";

import { useAuth } from "./context/AuthContext";
import { fetchDashboardSummary, type DashboardSummary } from "./services/dashboard";
import { fetchAllTerritories, fetchTerritory, type TerritoryState } from "./services/territory";
import { fetchLeaderboard, type LeaderboardRow } from "./services/leaderboard";

const FALLBACK_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

function getRegionFromPolygon(coords: TerritoryState["coordinates"]): Region {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.01),
  };
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();

  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);

  const [territory, setTerritory] = React.useState<TerritoryState | null>(null);
  const [allTerritories, setAllTerritories] = React.useState<TerritoryState[]>([]);
  const [territoryError, setTerritoryError] = React.useState<string | null>(null);

  const [leaderboard, setLeaderboard] = React.useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState(false);
  const [leaderboardError, setLeaderboardError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    let active = true;
    setLoadingSummary(true);
    setSummaryError(null);

    fetchDashboardSummary(user.uid)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load summary";
        setSummaryError(message);
      })
      .finally(() => {
        if (active) setLoadingSummary(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTerritory(null);
      return;
    }
    let active = true;
    setTerritoryError(null);

    fetchTerritory(user.uid)
      .then((data) => {
        if (active) setTerritory(data);
      })
      .then(async () => {
        const all = await fetchAllTerritories();
        if (active) setAllTerritories(all);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load territory";
        setTerritoryError(message);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    setLeaderboardLoading(true);
    setLeaderboardError(null);

    fetchLeaderboard("distance", "weekly")
      .then((rows) => {
        if (active) setLeaderboard(rows.slice(0, 5));
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load leaderboard";
        setLeaderboardError(message);
      })
      .finally(() => {
        if (active) setLeaderboardLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const name = user?.displayName || "Runner";
  const territoryRegion = territory?.coordinates ? getRegionFromPolygon(territory.coordinates) : FALLBACK_REGION;

  const totalKm = summary ? summary.totalDistanceM / 1000 : 0;
  const weekKm = summary ? summary.weekDistanceM / 1000 : 0; // if you don't have weekDistanceM, remove this line
  const monthKm = summary ? summary.monthDistanceM / 1000 : 0; // if you don't have monthDistanceM, remove this line

  const lastRunText = summary?.lastRun
    ? `${(summary.lastRun.distanceM / 1000).toFixed(2)} km • ${Math.round(summary.lastRun.durationSec)}s`
    : "No runs yet";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {/* HEADER (Figma style) */}
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>

            <View style={styles.headerMain}>
              <Text style={styles.h1}>
                Hey, <Text style={styles.h1Accent}>{name}</Text>
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {user?.email || ""}
              </Text>
            </View>

            <Pressable onPress={signOut} style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}>
              <Text style={styles.signOutIcon}>⎋</Text>
            </Pressable>
          </View>
        </View>

        {/* TODAY FOCUS card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🎯</Text>
            </View>
            <Text style={styles.cardTitle}>Today's Focus</Text>
          </View>

          <Text style={styles.cardBody}>Stay consistent. Every run adds territory.</Text>

          {loadingSummary ? <Text style={styles.hint}>Loading your progress...</Text> : null}
          {summaryError ? <Text style={styles.error}>{summaryError}</Text> : null}
        </View>

        {/* TERRITORY card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🗺️</Text>
            </View>
            <Text style={styles.cardTitle}>Your Territory</Text>
          </View>

          {/* Total distance big box */}
          <View style={styles.bigBox}>
            <View style={styles.bigTop}>
              <Text style={styles.dimLabel}>Total Distance</Text>
              <Text style={styles.dimIcon}>📈</Text>
            </View>
            <Text style={styles.bigValue}>
              {totalKm.toFixed(1)} <Text style={styles.bigUnit}>km</Text>
            </Text>
          </View>

          {/* Mini boxes (This Week / This Month) - if you don't have those fields, keep Total Runs + Area instead */}
          <View style={styles.grid2}>
            <View style={styles.smallBox}>
              <Text style={styles.dimLabel}>Total Runs</Text>
              <Text style={styles.smallValue}>{summary ? summary.totalRuns : 0}</Text>
            </View>

            <View style={styles.smallBox}>
              <Text style={styles.dimLabel}>Territory Area</Text>
              <Text style={styles.smallValue}>
                {territory ? Math.round(territory.areaM2).toLocaleString() : 0}{" "}
                <Text style={styles.smallUnit}>m²</Text>
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Total territory</Text>
            <Text style={styles.metaValue}>
              {summary ? Math.round(summary.totalAreaM2).toLocaleString() : 0} m²
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last run</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {lastRunText}
            </Text>
          </View>

          {/* MAP section inside same card */}
          <View style={styles.mapWrap}>
            <View style={styles.mapClip}>
              <MapView style={styles.map} region={territoryRegion}>
                {allTerritories.map((shape, index) => {
                  const isOwn = !!user && shape.userId === user.uid;
                  return (
                    <Polygon
                      key={`${shape.userId ?? "unknown"}-${index}`}
                      coordinates={shape.coordinates}
                      fillColor={isOwn ? "rgba(220,38,38,0.22)" : "rgba(255,255,255,0.08)"}
                      strokeColor={isOwn ? "#DC2626" : "rgba(255,255,255,0.18)"}
                      strokeWidth={isOwn ? 2 : 1}
                    />
                  );
                })}
              </MapView>
            </View>

            <Text style={styles.hint}>
              {territory?.coordinates
                ? `${Math.round(territory.areaM2).toLocaleString()} m² claimed so far`
                : "No territory yet. Complete your first valid run."}
            </Text>

            {territoryError ? <Text style={styles.error}>{territoryError}</Text> : null}
          </View>
        </View>

        {/* START RUN button (Figma style) */}
        <Pressable style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]} onPress={() => navigation.navigate("Run")}>
          <View style={styles.playCircle}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
          <Text style={styles.startText}>Start Run</Text>
        </Pressable>

        {/* HOME Leaderboard preview card (tap -> LeaderboardScreen) */}
        <Pressable onPress={() => navigation.navigate("Leaderboard")} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🏆</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Leaderboard</Text>
              <Text style={styles.hint}>Top runners this week</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </View>

          {leaderboardLoading ? <Text style={styles.hint}>Loading rankings...</Text> : null}
          {leaderboardError ? <Text style={styles.error}>{leaderboardError}</Text> : null}
          {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 ? (
            <Text style={styles.hint}>No ranked runs this week yet.</Text>
          ) : null}

          <View style={{ gap: 10, marginTop: 8 }}>
            {leaderboard.map((row) => {
              const isMe = row.userId === user?.uid;
              return (
                <View key={row.userId} style={[styles.lbRow, isMe && styles.lbRowMe]}>
                  <View style={styles.lbRankWrap}>
                    <Text style={styles.lbRank}>#{row.rank}</Text>
                  </View>

                  <View style={[styles.lbAvatar, isMe && styles.lbAvatarMe]}>
                    <Text style={styles.lbAvatarText}>{getInitials(row.username)}</Text>
                  </View>

                  <View style={styles.lbMain}>
                    <Text style={[styles.lbName, isMe && styles.lbNameMe]} numberOfLines={1}>
                      {row.username}
                    </Text>
                    <Text style={styles.lbSub}>Rank #{row.rank}</Text>
                  </View>

                  <View style={styles.lbValueWrap}>
                    <Text style={[styles.lbValue, isMe && styles.lbValueMe]}>{(row.value / 1000).toFixed(1)}</Text>
                    <Text style={styles.lbUnit}>km</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  page: { padding: 16, paddingBottom: 28, gap: 14, maxWidth: 520, alignSelf: "center", width: "100%" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },

  headerWrap: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(127, 29, 29, 0.30)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  headerMain: { flex: 1, minWidth: 0, gap: 2 },
  h1: { color: "#fff", fontSize: 20, fontWeight: "800" },
  h1Accent: { color: "#DC2626" },
  sub: { color: "#9CA3AF", fontSize: 12 },

  signOutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(220, 38, 38, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutIcon: { color: "#fff", fontSize: 16, fontWeight: "700" },

  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(220, 38, 38, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 16 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cardBody: { color: "#D1D5DB", fontSize: 14, lineHeight: 20, marginTop: 10 },

  hint: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
  error: { color: "#FB7185", fontSize: 12, marginTop: 8 },

  bigBox: { backgroundColor: "rgba(0,0,0,0.40)", borderRadius: 12, padding: 14, marginTop: 12 },
  bigTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dimLabel: { color: "#9CA3AF", fontSize: 13 },
  dimIcon: { fontSize: 14 },
  bigValue: { color: "#DC2626", fontWeight: "900", fontSize: 34, marginTop: 6 },
  bigUnit: { color: "#9CA3AF", fontWeight: "700", fontSize: 14 },

  grid2: { flexDirection: "row", gap: 10, marginTop: 10 },
  smallBox: { flex: 1, backgroundColor: "rgba(0,0,0,0.40)", borderRadius: 12, padding: 12 },
  smallValue: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 6 },
  smallUnit: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 10 },
  metaLabel: { color: "#9CA3AF", fontSize: 12 },
  metaValue: { color: "#E5E7EB", fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right" },

  mapWrap: { marginTop: 12, gap: 8 },
  mapClip: { borderRadius: 12, overflow: "hidden" },
  map: { width: "100%", height: 170 },

  startBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.50)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  startBtnPressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { color: "#fff", fontSize: 18, fontWeight: "900", marginLeft: 2 },
  startText: { color: "#fff", fontSize: 20, fontWeight: "900" },

  chev: { color: "#9CA3AF", fontSize: 22, fontWeight: "700" },

  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  lbRowMe: {
    backgroundColor: "rgba(220, 38, 38, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.55)",
  },
  lbRankWrap: { width: 38, alignItems: "center" },
  lbRank: { color: "#E5E7EB", fontWeight: "800" },
  lbAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  lbAvatarMe: { backgroundColor: "#DC2626" },
  lbAvatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  lbMain: { flex: 1, minWidth: 0 },
  lbName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  lbNameMe: { color: "#FCA5A5" },
  lbSub: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  lbValueWrap: { alignItems: "flex-end" },
  lbValue: { color: "#fff", fontSize: 14, fontWeight: "900" },
  lbValueMe: { color: "#FCA5A5" },
  lbUnit: { color: "#9CA3AF", fontSize: 12, marginTop: 1 },
});