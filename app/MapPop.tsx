import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
// @ts-ignore react-native-maps types are resolved at runtime in this Expo app
import MapView, { Polygon, type Region } from "react-native-maps";
import { subscribeAllTerritories, type TerritoryState } from "./services/territory";
import { useAuth } from "./context/AuthContext";

const FALLBACK_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12,
};
const NEARBY_TERRITORY_RADIUS_M = 2500;

function getRegionFromTerritories(territories: TerritoryState[]): Region | null {
  const points = territories.flatMap((t) => t.coordinates);
  if (points.length === 0) return null;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.01),
  };
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

export function MapPopScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const userInteractedRef = useRef(false);

  const [territories, setTerritories] = useState<TerritoryState[]>([]);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [currentLocation, setCurrentLocation] = useState<MapCoordinate | null>(null);

  useEffect(() => {
    const unsub = subscribeAllTerritories(
      (data) => {
        setTerritories(data);
      },
      () => {}
    );
    return unsub;
  }, []);

  const visibleTerritories = useMemo(() => {
    if (!currentLocation) {
      return territories;
    }
    const nearby = territories.filter((shape) => isTerritoryNearby(shape, currentLocation, NEARBY_TERRITORY_RADIUS_M));
    return nearby.length > 0 ? nearby : [];
  }, [territories, currentLocation]);

  const computedRegion = useMemo(() => getRegionFromTerritories(visibleTerritories) ?? FALLBACK_REGION, [visibleTerritories]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    if (layout.width <= 0 || layout.height <= 0) {
      return;
    }
    const territoryPoints = visibleTerritories.flatMap((t) => t.coordinates);
    const fitPoints = currentLocation ? [currentLocation, ...territoryPoints] : territoryPoints;
    if (fitPoints.length < 2) {
      if (!currentLocation) {
        return;
      }
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        650
      );
      return;
    }
    mapRef.current.fitToCoordinates(fitPoints, {
      edgePadding: { top: 110, right: 24, bottom: 150, left: 24 },
      animated: true,
    });
  }, [visibleTerritories, currentLocation, layout.width, layout.height]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={computedRegion}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout({ width, height });
        }}
        onRegionChangeComplete={(_, details: any) => {
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
          return (
            <Polygon
              key={`${shape.userId ?? "unknown"}-${index}`}
              coordinates={shape.coordinates}
              fillColor={isOwn ? "rgba(220,38,38,0.26)" : "rgba(156,163,175,0.18)"}
              strokeColor={isOwn ? "#DC2626" : "#9CA3AF"}
              strokeWidth={isOwn ? 3 : 2}
            />
          );
        })}
      </MapView>

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          hitSlop={12}
          android_ripple={{ color: "rgba(255,255,255,0.10)" }}
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <Text style={styles.title}>Territory Map</Text>
        <View style={{ width: 42, height: 42 }} />
      </View>

      <View style={[styles.bottomHint, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Text style={styles.hintText}>{`Nearby territories: ${visibleTerritories.length}`}</Text>
        <Text style={styles.hintText}>Pinch to zoom, drag to pan.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: -2 },
  title: { color: "#fff", fontSize: 16, fontWeight: "900" },
  bottomHint: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 2,
    marginBottom: 10,
  },
  hintText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" },
});
