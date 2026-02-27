import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { fetchDashboardSummary, type DashboardSummary } from "./services/dashboard";
import MapView, { Polygon, type Region } from "react-native-maps";
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
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.6, 0.01);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.6, 0.01);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "R";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
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
        if (active) {
          setSummary(data);
        }
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load summary";
        setSummaryError(message);
      })
      .finally(() => {
        if (active) {
          setLoadingSummary(false);
        }
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
        if (active) {
          setTerritory(data);
        }
      })
      .then(async () => {
        const all = await fetchAllTerritories();
        if (active) {
          setAllTerritories(all);
        }
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
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
        if (active) {
          setLeaderboard(rows.slice(0, 5));
        }
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load leaderboard";
        setLeaderboardError(message);
      })
      .finally(() => {
        if (active) {
          setLeaderboardLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const territoryRegion = territory?.coordinates ? getRegionFromPolygon(territory.coordinates) : FALLBACK_REGION;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(user?.displayName || "Runner")}</Text>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Hey, {user?.displayName || "Runner"}</Text>
              <Text style={styles.subtitle}>{user?.email}</Text>
            </View>
          </View>
          <Pressable style={styles.signOutIcon} onPress={signOut}>
            <Text style={styles.signOutIconText}>?</Text>
          </Pressable>
        </View>

        <Pressable style={styles.runButton} onPress={() => navigation.navigate("Run")}>
          <View style={styles.runIconCircle}>
            <Text style={styles.runIcon}>?</Text>
          </View>
          <Text style={styles.runButtonText}>Start Run</Text>
        </Pressable>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Today's Focus</Text>
          <Text style={styles.panelBody}>Stay consistent. Every run adds territory.</Text>
          {loadingSummary ? <Text style={styles.panelHint}>Loading your progress...</Text> : null}
          {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your Territory</Text>
          <View style={styles.bigMetricRow}>
            <Text style={styles.bigMetricValue}>{summary ? (summary.totalDistanceM / 1000).toFixed(1) : "0.0"}</Text>
            <Text style={styles.bigMetricUnit}> km</Text>
          </View>
          <Text style={styles.panelHint}>Total distance</Text>
          <View style={styles.territoryStatsRow}>
            <View style={styles.territoryStatCell}>
              <Text style={styles.territoryStatLabel}>Total runs</Text>
              <Text style={styles.territoryStatValue}>{summary ? summary.totalRuns : 0}</Text>
            </View>
            <View style={styles.territoryStatCell}>
              <Text style={styles.territoryStatLabel}>Territory area</Text>
              <Text style={styles.territoryStatValue}>
                {territory ? Math.round(territory.areaM2).toLocaleString() : 0} sq m
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total territory</Text>
            <Text style={styles.summaryValue}>{summary ? Math.round(summary.totalAreaM2).toLocaleString() : 0} m²</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Last run</Text>
            <Text style={styles.summaryValue}>
              {summary?.lastRun
                ? `${(summary.lastRun.distanceM / 1000).toFixed(2)} km • ${Math.round(summary.lastRun.durationSec)}s`
                : "No runs yet"}
            </Text>
          </View>
        </View>
        <View style={styles.mapCard}>
          <Text style={styles.mapTitle}>Your Territory</Text>
          <MapView style={styles.map} initialRegion={territoryRegion} region={territoryRegion}>
            {allTerritories.map((shape, index) => {
              const isOwn = !!user && shape.userId === user.uid;
              return (
                <Polygon
                  key={`${shape.userId ?? "unknown"}-${index}`}
                  coordinates={shape.coordinates}
                  fillColor={isOwn ? "rgba(34,197,94,0.25)" : "rgba(251,191,36,0.18)"}
                  strokeColor={isOwn ? "#16a34a" : "#f59e0b"}
                  strokeWidth={isOwn ? 2 : 1}
                />
              );
            })}
          </MapView>
          <Text style={styles.mapCaption}>
            {territory?.coordinates
              ? `${Math.round(territory.areaM2).toLocaleString()} m² claimed so far`
              : "No territory yet. Complete your first valid run."}
          </Text>
          {territoryError ? <Text style={styles.errorText}>{territoryError}</Text> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Leaderboard</Text>
          {leaderboardLoading ? <Text style={styles.panelHint}>Loading rankings...</Text> : null}
          {leaderboardError ? <Text style={styles.errorText}>{leaderboardError}</Text> : null}
          {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 ? (
            <Text style={styles.panelHint}>No ranked runs this week yet.</Text>
          ) : null}
          <View style={styles.leaderboardList}>
            {leaderboard.map((row) => {
              const isCurrentUser = row.userId === user?.uid;
              return (
                <View key={row.userId} style={[styles.leaderRow, isCurrentUser && styles.leaderRowCurrent]}>
                  <Text style={styles.leaderRank}>#{row.rank}</Text>
                  <View style={styles.leaderAvatar}>
                    <Text style={styles.leaderAvatarText}>{getInitials(row.username)}</Text>
                  </View>
                  <View style={styles.leaderMain}>
                    <Text style={styles.leaderName}>{row.username}</Text>
                    <Text style={styles.leaderSub}>Rank #{row.rank}</Text>
                  </View>
                  <View style={styles.leaderValueWrap}>
                    <Text style={styles.leaderValue}>{(row.value / 1000).toFixed(1)}</Text>
                    <Text style={styles.leaderUnit}>km</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerTextWrap: {
    gap: 3,
    flexShrink: 1,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#D40016",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 13,
    color: "#b9c0d4",
  },
  signOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#5c0b12",
    backgroundColor: "#140406",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  signOutIconText: {
    color: "#f4f6ff",
    fontSize: 20,
    fontWeight: "700",
  },
  runButton: {
    backgroundColor: "#CF0016",
    borderRadius: 18,
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#ff2a3f",
  },
  runIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  runIcon: {
    color: "#ffffff",
    marginLeft: 2,
    fontSize: 16,
    fontWeight: "900",
  },
  runButtonText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: "#070707",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#4A090F",
    gap: 12,
  },
  panelTitle: {
    fontSize: 33,
    fontWeight: "700",
    color: "#ffffff",
  },
  panelBody: {
    fontSize: 26,
    color: "#f8f9ff",
    lineHeight: 34,
  },
  panelHint: {
    fontSize: 13,
    color: "#A7B0C8",
  },
  errorText: {
    fontSize: 12,
    color: "#ff7d89",
  },
  bigMetricRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
  },
  bigMetricValue: {
    fontSize: 46,
    fontWeight: "700",
    color: "#ff1b2f",
    lineHeight: 48,
  },
  bigMetricUnit: {
    fontSize: 28,
    color: "#d8deef",
    paddingBottom: 3,
  },
  territoryStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 10,
  },
  territoryStatCell: {
    flex: 1,
    backgroundColor: "#080c14",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1a2638",
  },
  territoryStatLabel: {
    fontSize: 12,
    color: "#9fa8c2",
  },
  territoryStatValue: {
    fontSize: 18,
    color: "#f3f6ff",
    fontWeight: "700",
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  summaryLabel: {
    color: "#9fa8c2",
    fontSize: 12,
  },
  summaryValue: {
    color: "#f3f6ff",
    fontSize: 13,
    fontWeight: "700",
  },
  lastRunText: {
    marginTop: 2,
    fontSize: 13,
    color: "#d1d8ea",
  },
  mapCard: {
    backgroundColor: "#070707",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#4A090F",
    padding: 12,
    gap: 8,
  },
  mapTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  map: {
    width: "100%",
    height: 170,
    borderRadius: 12,
  },
  mapCaption: {
    color: "#A7B0C8",
    fontSize: 12,
  },
  leaderboardList: {
    gap: 10,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#040506",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#22242d",
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
  },
  leaderRowCurrent: {
    borderColor: "#ff2d41",
    backgroundColor: "#2a0208",
  },
  leaderRank: {
    width: 34,
    color: "#f8f9ff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  leaderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#34435f",
    alignItems: "center",
    justifyContent: "center",
  },
  leaderAvatarText: {
    color: "#e8ecff",
    fontWeight: "700",
    fontSize: 12,
  },
  leaderMain: {
    flex: 1,
  },
  leaderName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  leaderSub: {
    color: "#a9b3cc",
    fontSize: 20,
    marginTop: 1,
  },
  leaderValueWrap: {
    alignItems: "flex-end",
  },
  leaderValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "600",
  },
  leaderUnit: {
    color: "#a8b0c8",
    fontSize: 18,
  },
});
