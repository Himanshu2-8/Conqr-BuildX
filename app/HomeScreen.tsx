import React, { useEffect } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { fetchDashboardSummary, type DashboardSummary } from "./services/dashboard";
import MapView, { Polygon, type Region } from "react-native-maps";
import { fetchTerritory, type TerritoryState } from "./services/territory";

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

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [territory, setTerritory] = React.useState<TerritoryState | null>(null);
  const [territoryError, setTerritoryError] = React.useState<string | null>(null);

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

  const territoryRegion = territory?.coordinates ? getRegionFromPolygon(territory.coordinates) : FALLBACK_REGION;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Hey {user?.displayName || "Runner"}</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today’s focus</Text>
          <Text style={styles.cardSubtitle}>Stay consistent. Every run adds territory.</Text>
          {loadingSummary ? <Text style={styles.cardSubtitle}>Loading your progress...</Text> : null}
          {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Runs</Text>
              <Text style={styles.statValue}>{summary ? summary.totalRuns : 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{summary ? (summary.totalDistanceM / 1000).toFixed(1) : "0.0"} km</Text>
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
            {territory?.coordinates ? (
              <Polygon
                coordinates={territory.coordinates}
                fillColor="rgba(34,197,94,0.25)"
                strokeColor="#16a34a"
                strokeWidth={2}
              />
            ) : null}
          </MapView>
          <Text style={styles.mapCaption}>
            {territory?.coordinates
              ? `${Math.round(territory.areaM2).toLocaleString()} m² claimed so far`
              : "No territory yet. Complete your first valid run."}
          </Text>
          {territoryError ? <Text style={styles.errorText}>{territoryError}</Text> : null}
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Run")}>
            <Text style={styles.primaryButtonText}>Start Run</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={signOut}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 14,
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
    color: "#cbd5f5",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  mapCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  map: {
    width: "100%",
    height: 170,
    borderRadius: 12,
  },
  mapCaption: {
    fontSize: 12,
    color: "#64748b",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: "#e2e8f0",
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
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
  primaryButtonText: {
    color: "#052e16",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
  },
});
