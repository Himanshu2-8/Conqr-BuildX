import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MapView, { Polygon, type Region } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { FogOverlay } from "./components/FogOverlay";
import { useAuth } from "./context/AuthContext";
import { useEntranceAnim } from "./hooks/useEntranceAnim";
import { useFogOfWar } from "./hooks/useFogOfWar";
import { fetchDashboardSummary, type DashboardSummary } from "./services/dashboard";
import { subscribeAllTerritories, type TerritoryState } from "./services/territory";
import { subscribeLeaderboard, type LeaderboardRow } from "./services/leaderboard";
import { subscribeWeeklyCityBattle, type CityBattleRow } from "./services/cityBattle";
import { fetchMissionsSummary, type QuestProgress } from "./services/missions";
import { LiveBadge } from "./ui/LiveBadge";
import { fetchUserProfile } from "./services/profile";

const FALLBACK_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};
const NEARBY_TERRITORY_RADIUS_M = 2500;

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

function getRegionFromTerritories(shapes: TerritoryState[]): Region | null {
  const coords = shapes.flatMap((shape) => shape.coordinates);
  if (coords.length === 0) {
    return null;
  }
  return getRegionFromPolygon(coords);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getColorForUser(userId: string | undefined, isOwn: boolean) {
  if (isOwn) {
    return { fill: "rgba(220,38,38,0.30)", stroke: "#DC2626" };
  }
  if (!userId) {
    return { fill: "rgba(14,165,233,0.30)", stroke: "#0284C7" };
  }
  const palette = [
    { fill: "rgba(234,179,8,0.30)", stroke: "#CA8A04" },
    { fill: "rgba(16,185,129,0.30)", stroke: "#059669" },
    { fill: "rgba(59,130,246,0.30)", stroke: "#2563EB" },
    { fill: "rgba(168,85,247,0.30)", stroke: "#9333EA" },
    { fill: "rgba(249,115,22,0.30)", stroke: "#EA580C" },
  ];
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function getRankBadge(rank: number) {
  if (rank === 1) {
    return { icon: "trophy", color: "#FACC15" };
  }
  if (rank === 2) {
    return { icon: "trophy", color: "#CBD5E1" };
  }
  if (rank === 3) {
    return { icon: "trophy", color: "#D97706" };
  }
  return { icon: "medal-outline", color: "#9CA3AF" };
}

function GradientCard({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={["#1a0205", "#050505"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {children}
    </LinearGradient>
  );
}

function GradientBox({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <LinearGradient
      colors={["rgba(139,0,0,0.25)", "rgba(0,0,0,0.45)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientBoxBase, style]}
    >
      {children}
    </LinearGradient>
  );
}

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: MapCoordinate, b: MapCoordinate) {
  const r = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isTerritoryNearby(territory: TerritoryState, location: MapCoordinate, radiusM: number) {
  for (const point of territory.coordinates) {
    if (distanceMeters(point, location) <= radiusM) {
      return true;
    }
  }
  return false;
}

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView | null>(null);
  const userInteractedRef = useRef(false);

  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [profileUsername, setProfileUsername] = React.useState<string>("");

  const [territory, setTerritory] = React.useState<TerritoryState | null>(null);
  const [allTerritories, setAllTerritories] = React.useState<TerritoryState[]>([]);
  const [territoryError, setTerritoryError] = React.useState<string | null>(null);

  const [leaderboard, setLeaderboard] = React.useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState(false);
  const [leaderboardError, setLeaderboardError] = React.useState<string | null>(null);
  const [cityBattleRows, setCityBattleRows] = React.useState<CityBattleRow[]>([]);
  const [cityBattleLoading, setCityBattleLoading] = React.useState(false);
  const [cityBattleError, setCityBattleError] = React.useState<string | null>(null);
  const [missions, setMissions] = React.useState<QuestProgress[]>([]);
  const [missionsLoading, setMissionsLoading] = React.useState(false);
  const [missionsError, setMissionsError] = React.useState<string | null>(null);
  const [territoryUpdatedAt, setTerritoryUpdatedAt] = React.useState<Date | null>(null);
  const [leaderboardUpdatedAt, setLeaderboardUpdatedAt] = React.useState<Date | null>(null);
  const [mapRegion, setMapRegion] = React.useState<Region>(FALLBACK_REGION);
  const [currentLocation, setCurrentLocation] = React.useState<MapCoordinate | null>(null);
  const [mapLayout, setMapLayout] = React.useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setProfileUsername("");
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
      setProfileUsername("");
      return;
    }
    let active = true;
    fetchUserProfile(user.uid, user.email ?? "")
      .then((profile) => {
        if (!active) return;
        setProfileUsername(typeof profile.username === "string" ? profile.username : "");
      })
      .catch(() => {
        if (!active) return;
        setProfileUsername("");
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTerritory(null);
      setAllTerritories([]);
      return;
    }

    setTerritoryError(null);
    const unsubscribe = subscribeAllTerritories(
      (rows) => {
        setAllTerritories(rows);
        setTerritory(rows.find((row) => row.userId === user.uid) ?? null);
        setTerritoryUpdatedAt(new Date());
      },
      (err) => {
        setTerritoryError(err.message || "Failed to load all territories");
      }
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    const unsubscribe = subscribeLeaderboard(
      "distance",
      "weekly",
      (rows) => {
        setLeaderboard(rows.slice(0, 5));
        setLeaderboardLoading(false);
        setLeaderboardUpdatedAt(new Date());
      },
      (err) => {
        setLeaderboardError(err.message || "Failed to load leaderboard");
        setLeaderboardLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    setCityBattleLoading(true);
    setCityBattleError(null);
    const unsubscribe = subscribeWeeklyCityBattle(
      (rows) => {
        setCityBattleRows(rows.slice(0, 5));
        setCityBattleLoading(false);
      },
      (err) => {
        setCityBattleError(err.message || "Failed to load city battle");
        setCityBattleLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setMissions([]);
      return;
    }

    let active = true;
    setMissionsLoading(true);
    setMissionsError(null);
    fetchMissionsSummary(user.uid)
      .then((summary) => {
        if (!active) {
          return;
        }
        setMissions(summary.quests);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load missions";
        setMissionsError(message);
      })
      .finally(() => {
        if (active) {
          setMissionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const name = profileUsername.trim() || user?.displayName || "Runner";
  const allRegion = getRegionFromTerritories(allTerritories);
  const territoryRegion = allRegion ?? (territory?.coordinates ? getRegionFromPolygon(territory.coordinates) : FALLBACK_REGION);
  const visibleTerritories = React.useMemo(() => {
    if (!currentLocation) {
      return allTerritories;
    }
    const nearby = allTerritories.filter((shape) => isTerritoryNearby(shape, currentLocation, NEARBY_TERRITORY_RADIUS_M));
    return nearby.length > 0 ? nearby : [];
  }, [allTerritories, currentLocation]);
  const territoryRevealPoints = React.useMemo(
    () => visibleTerritories.flatMap((shape) => shape.coordinates),
    [visibleTerritories]
  );
  const extraRevealPoints = React.useMemo(
    () => (currentLocation ? [currentLocation, ...territoryRevealPoints] : territoryRevealPoints),
    [currentLocation, territoryRevealPoints]
  );
  const { fogEnabled, exploredCount, loading: fogLoading, revealAroundPoints } = useFogOfWar(
    user?.uid ?? null,
    mapRegion,
    extraRevealPoints
  );
  const totalKm = summary ? summary.totalDistanceM / 1000 : 0;

  const lastRunText = summary?.lastRun
    ? `${(summary.lastRun.distanceM / 1000).toFixed(2)} km - ${Math.round(summary.lastRun.durationSec)}s`
    : "No runs yet";
  const homeLeaderboardRows = React.useMemo(() => {
    const topThree = leaderboard.slice(0, 3);
    if (!user?.uid) {
      return topThree;
    }
    const me = leaderboard.find((row) => row.userId === user.uid);
    if (!me) {
      return topThree;
    }
    if (topThree.some((row) => row.userId === me.userId)) {
      return topThree;
    }
    return [...topThree, me];
  }, [leaderboard, user?.uid]);
  const territoryLiveText = territoryUpdatedAt ? `Last updated ${territoryUpdatedAt.toLocaleTimeString()}` : "Waiting for live map...";
  const leaderboardLiveText = leaderboardUpdatedAt
    ? `Last updated ${leaderboardUpdatedAt.toLocaleTimeString()}`
    : "Waiting for live rankings...";
  const pageAnim = useEntranceAnim(60, 16);

  useEffect(() => {
    // Avoid fighting the user. If the user has panned/zoomed, do not override their view.
    if (userInteractedRef.current) {
      return;
    }
    setMapRegion(territoryRegion);
  }, [
    territoryRegion.latitude,
    territoryRegion.longitude,
    territoryRegion.latitudeDelta,
    territoryRegion.longitudeDelta,
  ]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    if (mapLayout.width <= 0 || mapLayout.height <= 0) {
      return;
    }
    const territoryPoints = visibleTerritories.flatMap((shape) => shape.coordinates) as MapCoordinate[];
    const fitPoints = currentLocation ? [currentLocation, ...territoryPoints] : territoryPoints;

    if (fitPoints.length >= 2) {
      mapRef.current.fitToCoordinates(fitPoints, {
        edgePadding: { top: 34, right: 22, bottom: 34, left: 22 },
        animated: true,
      });
      return;
    }
    if (!currentLocation) {
      return;
    }
    const nextRegion: Region = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    };
    setMapRegion(nextRegion);
    mapRef.current.animateToRegion(nextRegion, 650);
  }, [visibleTerritories, currentLocation, mapLayout.width, mapLayout.height]);

  useEffect(() => {
    if (!currentLocation) {
      return;
    }
    revealAroundPoints([currentLocation]);
  }, [currentLocation, revealAroundPoints]);

  useEffect(() => {
    if (!currentLocation || territory) {
      return;
    }

    setMapRegion((prev) => ({
      ...prev,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: Math.min(prev.latitudeDelta, 0.02),
      longitudeDelta: Math.min(prev.longitudeDelta, 0.02),
    }));
  }, [currentLocation, territory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.screen, pageAnim]}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Dashboard</Text>
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
              <Image source={require("./assets/logout.png")} style={styles.signOutIconImage} />
            </Pressable>
          </View>
        </View>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Image source={require("./assets/target.png")} style={styles.cardIconImage} />
            </View>
            <Text style={styles.cardTitle}>Today's Focus</Text>
          </View>
          <Text style={styles.cardBody}>Stay consistent. Every run adds territory.</Text>
          {loadingSummary ? <Text style={styles.hint}>Loading your progress...</Text> : null}
          {summaryError ? <Text style={styles.error}>{summaryError}</Text> : null}
        </GradientCard>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Image source={require("./assets/map.png")} style={styles.cardIconImage} />
            </View>
            <Text style={styles.cardTitle}>Your Territory</Text>
            <LiveBadge />
          </View>

          <GradientBox style={styles.bigBox}>
            <View style={styles.bigTop}>
              <Text style={styles.dimLabel}>Total Distance</Text>
              <Text style={styles.dimIcon}>+</Text>
            </View>
            <Text style={styles.bigValue}>
              {totalKm.toFixed(1)} <Text style={styles.bigUnit}>km</Text>
            </Text>
          </GradientBox>

          <View style={styles.grid2}>
            <GradientBox style={styles.smallBox}>
              <Text style={styles.dimLabel}>Total Runs</Text>
              <Text style={styles.smallValue}>{summary ? summary.totalRuns : 0}</Text>
            </GradientBox>
            <GradientBox style={styles.smallBox}>
              <Text style={styles.dimLabel}>Territory Area</Text>
              <Text style={styles.smallValue}>
                {territory ? Math.round(territory.areaM2).toLocaleString() : 0} <Text style={styles.smallUnit}>m2</Text>
              </Text>
            </GradientBox>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Total territory</Text>
            <Text style={styles.metaValue}>{summary ? Math.round(summary.totalAreaM2).toLocaleString() : 0} m2</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last run</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {lastRunText}
            </Text>
          </View>

          <View style={styles.mapWrap}>
            <View
              style={styles.mapClip}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setMapLayout({ width, height });
              }}
            >
              <Pressable
                onPress={() => navigation.navigate("MapPop")}
                hitSlop={10}
                style={({ pressed }) => [styles.mapExpandBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="arrow-expand" size={16} color="#fff" />
              </Pressable>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={territoryRegion}
                onRegionChangeComplete={(region, details: any) => {
                  setMapRegion(region);
                  if (details?.isGesture) {
                    userInteractedRef.current = true;
                  }
                }}
                showsUserLocation
                showsMyLocationButton
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
                {visibleTerritories.map((shape, index) => {
                  const isOwn = !!user && shape.userId === user.uid;
                  const colors = getColorForUser(shape.userId, isOwn);
                  return (
                    <Polygon
                      key={`${shape.userId ?? "unknown"}-${index}`}
                      coordinates={shape.coordinates}
                      fillColor={colors.fill}
                      strokeColor={colors.stroke}
                      strokeWidth={isOwn ? 2 : 1}
                    />
                  );
                })}
              </MapView>
              {fogEnabled ? (
                <FogOverlay
                  width={mapLayout.width}
                  height={mapLayout.height}
                  region={mapRegion}
                  revealPolygons={visibleTerritories.map((shape) => shape.coordinates)}
                />
              ) : null}
            </View>
            <Text style={styles.hint}>Territories shown: {visibleTerritories.length}</Text>
            <Text style={styles.hint}>
              {`Fog active. ${exploredCount} tiles explored${fogLoading ? "..." : "."}`}
            </Text>
            <Text style={styles.hint}>
              {currentLocation ? "Current location visible." : "Waiting for current location..."}
            </Text>
            <Text style={styles.hint}>{territoryLiveText}</Text>
            <Text style={styles.hint}>
              {territory?.coordinates
                ? `${Math.round(territory.areaM2).toLocaleString()} m2 claimed so far`
                : "No territory yet. Complete your first valid run."}
            </Text>
            {territoryError ? <Text style={styles.error}>{territoryError}</Text> : null}
          </View>
        </GradientCard>

        <Pressable style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]} onPress={() => navigation.navigate("Run")}>
          <View style={styles.playCircle}>
            <MaterialCommunityIcons name="play" size={18} color="#fff" style={styles.playIcon} />
          </View>
          <Text style={styles.startText}>Start Run</Text>
        </Pressable>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="flag-checkered" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Active Missions</Text>
              <Text style={styles.hint}>Real-life goals for this week</Text>
            </View>
          </View>
          {missionsLoading ? <Text style={styles.hint}>Loading missions...</Text> : null}
          {missionsError ? <Text style={styles.error}>{missionsError}</Text> : null}
          {!missionsLoading && !missionsError && missions.length === 0 ? (
            <Text style={styles.hint}>No active missions yet.</Text>
          ) : null}
          <View style={styles.missionsList}>
            {missions.map((mission) => {
              const pct = mission.target > 0 ? Math.min((mission.progress / mission.target) * 100, 100) : 0;
              return (
                <View key={mission.id} style={styles.missionItem}>
                  <View style={styles.missionHead}>
                    <Text style={styles.missionTitle}>{mission.title}</Text>
                    <Text style={[styles.missionStatus, mission.completed && styles.missionStatusDone]}>
                      {mission.completed ? "Done" : `${Math.round(pct)}%`}
                    </Text>
                  </View>
                  <Text style={styles.hint}>{mission.description}</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </GradientCard>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="city-variant-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Territory Battle</Text>
              <Text style={styles.hint}>Weekly city points (area + weighted distance)</Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          {cityBattleLoading ? <Text style={styles.hint}>Loading city battle...</Text> : null}
          {cityBattleError ? <Text style={styles.error}>{cityBattleError}</Text> : null}
          {!cityBattleLoading && !cityBattleError && cityBattleRows.length === 0 ? (
            <Text style={styles.hint}>No city points this week yet.</Text>
          ) : null}

          <View style={{ gap: 10, marginTop: 8 }}>
            {cityBattleRows.map((row, index) => {
              const badge = getRankBadge(index + 1);
              return (
                <View key={`${row.weekKey}-${row.city}`} style={styles.lbRow}>
                  <View style={styles.lbRankWrap}>
                    <MaterialCommunityIcons name={badge.icon as any} size={16} color={badge.color} />
                  </View>
                  <View style={styles.lbMain}>
                    <Text style={styles.lbName} numberOfLines={1}>
                      {row.city}
                    </Text>
                    <Text style={styles.hint}>Runs: {row.totalRuns} - Updated: {row.updatedAtLabel}</Text>
                  </View>
                  <View style={styles.lbValueWrap}>
                    <Text style={styles.lbValue}>{Math.round(row.score).toLocaleString()}</Text>
                    <Text style={styles.lbUnit}>pts</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GradientCard>
        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="trophy" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Leaderboard</Text>
              <Text style={styles.hint}>Top 3 + your position</Text>
            </View>
            <LiveBadge />
          </View>
          <Text style={styles.hint}>{leaderboardLiveText}</Text>

          {leaderboardLoading ? <Text style={styles.hint}>Loading rankings...</Text> : null}
          {leaderboardError ? <Text style={styles.error}>{leaderboardError}</Text> : null}
          {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 ? (
            <Text style={styles.hint}>No ranked runs this week yet.</Text>
          ) : null}

          <View style={{ gap: 10, marginTop: 8 }}>
            {homeLeaderboardRows.map((row) => {
              const isMe = row.userId === user?.uid;
              const badge = getRankBadge(row.rank);
              return (
                <View key={row.userId} style={[styles.lbRow, isMe && styles.lbRowMe]}>
                  <View style={styles.lbRankWrap}>
                    <MaterialCommunityIcons name={badge.icon as any} size={16} color={badge.color} />
                  </View>

                  <View style={[styles.lbAvatar, isMe && styles.lbAvatarMe]}>
                    <Text style={styles.lbAvatarText}>{getInitials(row.username)}</Text>
                  </View>

                  <View style={styles.lbMain}>
                    <Text style={[styles.lbName, isMe && styles.lbNameMe]} numberOfLines={1}>
                      {row.username}
                    </Text>
                  </View>

                  <View style={styles.lbValueWrap}>
                    <Text style={[styles.lbValue, isMe && styles.lbValueMe]}>{(row.value / 1000).toFixed(1)}</Text>
                    <Text style={styles.lbUnit}>km</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GradientCard>

      </ScrollView>
      <View style={styles.footerNav}>
        <Pressable style={styles.footerBtn} onPress={() => navigation.navigate("Quests")}>
          <MaterialCommunityIcons name="flag-checkered" size={16} color="#FCA5A5" />
          <Text style={styles.footerBtnText}>Quests</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => navigation.navigate("Friends")}>
          <MaterialCommunityIcons name="account-multiple-outline" size={16} color="#FCA5A5" />
          <Text style={styles.footerBtnText}>Friends</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => navigation.navigate("Profile")}>
          <MaterialCommunityIcons name="account-circle-outline" size={16} color="#FCA5A5" />
          <Text style={styles.footerBtnText}>Profile</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => navigation.navigate("Leaderboard")}>
          <MaterialCommunityIcons name="trophy" size={16} color="#FCA5A5" />
          <Text style={styles.footerBtnText}>Leaderboard</Text>
        </Pressable>
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  screen: { flex: 1 },
  page: { padding: 16, paddingBottom: 120, gap: 14, maxWidth: 520, alignSelf: "center", width: "100%" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  screenTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 2 },

  headerWrap: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(127, 29, 29, 0.30)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  headerMain: { flex: 1, minWidth: 0, gap: 2 },
  h1: { color: "#fff", fontSize: 18, fontWeight: "800" },
  h1Accent: { color: "#DC2626" },
  sub: { color: "#9CA3AF", fontSize: 11 },

  signOutBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(220, 38, 38, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutIconImage: {
    width: 15,
    height: 15,
    tintColor: "#DC2626",
  },

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
  cardIconImage: {
    width: 16,
    height: 16,
    tintColor: "#DC2626",
  },
  icon: { fontSize: 16, color: "#fff" },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cardBody: { color: "#D1D5DB", fontSize: 14, lineHeight: 20, marginTop: 10 },

  hint: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
  error: { color: "#FB7185", fontSize: 12, marginTop: 8 },
  gradientBoxBase: {
    borderRadius: 12,
  },

  bigBox: { padding: 14, marginTop: 12 },
  bigTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dimLabel: { color: "#9CA3AF", fontSize: 13 },
  dimIcon: { fontSize: 14, color: "#9CA3AF" },
  bigValue: { color: "#DC2626", fontWeight: "900", fontSize: 34, marginTop: 6 },
  bigUnit: { color: "#9CA3AF", fontWeight: "700", fontSize: 14 },

  grid2: { flexDirection: "row", gap: 10, marginTop: 10 },
  smallBox: { flex: 1, padding: 12 },
  smallValue: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 6 },
  smallUnit: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 10 },
  metaLabel: { color: "#9CA3AF", fontSize: 12 },
  metaValue: { color: "#E5E7EB", fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right" },

  mapWrap: { marginTop: 12, gap: 8 },
  mapClip: { borderRadius: 12, overflow: "hidden", position: "relative" },
  map: { width: "100%", height: 220 },
  mapExpandBtn: {
    position: "absolute",
    zIndex: 5,
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
  },

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
  playIcon: { marginLeft: 2 },
  startText: { color: "#fff", fontSize: 20, fontWeight: "900" },

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
  lbRankWrap: { width: 38, alignItems: "center", justifyContent: "center" },
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
  lbValueWrap: { alignItems: "flex-end" },
  lbValue: { color: "#fff", fontSize: 14, fontWeight: "900" },
  lbValueMe: { color: "#FCA5A5" },
  lbUnit: { color: "#9CA3AF", fontSize: 12, marginTop: 1 },
  missionsList: {
    gap: 10,
    marginTop: 10,
  },
  missionItem: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 6,
  },
  missionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  missionTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  missionStatus: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "800",
  },
  missionStatusDone: {
    color: "#86efac",
  },
  track: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#DC2626",
    borderRadius: 999,
  },
  footerNav: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(127, 29, 29, 0.30)",
    backgroundColor: "#000",
  },
  footerBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  footerBtnText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
  },
});











