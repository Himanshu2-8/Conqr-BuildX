import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TrackPoint } from "../hooks/useRunTracker";

type LatLngPoint = {
  latitude: number;
  longitude: number;
};

export type TerritoryState = {
  userId?: string;
  coordinates: LatLngPoint[];
  areaM2: number;
};

type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const DEFAULT_BUFFER_METERS = 25;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function metersToLatDegrees(meters: number) {
  return meters / 111320;
}

function metersToLngDegrees(meters: number, atLat: number) {
  const scale = Math.cos(toRadians(atLat));
  if (Math.abs(scale) < 0.00001) {
    return meters / 111320;
  }
  return meters / (111320 * scale);
}

function computeBounds(points: LatLngPoint[]): Bounds {
  return points.reduce<Bounds>(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, point.latitude),
      maxLat: Math.max(acc.maxLat, point.latitude),
      minLng: Math.min(acc.minLng, point.longitude),
      maxLng: Math.max(acc.maxLng, point.longitude),
    }),
    {
      minLat: points[0].latitude,
      maxLat: points[0].latitude,
      minLng: points[0].longitude,
      maxLng: points[0].longitude,
    }
  );
}

function expandBounds(bounds: Bounds, bufferMeters: number) {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const latBuffer = metersToLatDegrees(bufferMeters);
  const lngBuffer = metersToLngDegrees(bufferMeters, midLat);
  return {
    minLat: bounds.minLat - latBuffer,
    maxLat: bounds.maxLat + latBuffer,
    minLng: bounds.minLng - lngBuffer,
    maxLng: bounds.maxLng + lngBuffer,
  };
}

function boundsToPolygon(bounds: Bounds): LatLngPoint[] {
  return [
    { latitude: bounds.maxLat, longitude: bounds.minLng },
    { latitude: bounds.maxLat, longitude: bounds.maxLng },
    { latitude: bounds.minLat, longitude: bounds.maxLng },
    { latitude: bounds.minLat, longitude: bounds.minLng },
  ];
}

function isLatLngPoint(value: unknown): value is LatLngPoint {
  if (!value || typeof value !== "object") {
    return false;
  }
  const point = value as { latitude?: unknown; longitude?: unknown };
  return typeof point.latitude === "number" && typeof point.longitude === "number";
}

function normalizeStoredCoordinates(raw: unknown): LatLngPoint[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const coords = raw.filter(isLatLngPoint);
  return coords.length >= 4 ? coords : null;
}

function computeAreaMeters(bounds: Bounds) {
  const avgLat = (bounds.minLat + bounds.maxLat) / 2;
  const widthMeters = (bounds.maxLng - bounds.minLng) * 111320 * Math.cos(toRadians(avgLat));
  const heightMeters = (bounds.maxLat - bounds.minLat) * 111320;
  return Math.max(widthMeters, 0) * Math.max(heightMeters, 0);
}

export async function fetchTerritory(userId: string): Promise<TerritoryState | null> {
  const territoryRef = doc(db, "territories", userId);
  const snapshot = await getDoc(territoryRef);
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  if (!data?.coordinates) {
    return null;
  }
  const polygon = normalizeStoredCoordinates(data.coordinates);
  if (!polygon || polygon.length === 0) {
    return null;
  }
  return {
    userId,
    coordinates: polygon,
    areaM2: typeof data.areaM2 === "number" ? data.areaM2 : 0,
  };
}

export async function fetchAllTerritories(): Promise<TerritoryState[]> {
  const snapshot = await getDocs(collection(db, "territories"));
  return parseTerritoriesSnapshot(snapshot);
}

function parseTerritoriesSnapshot(snapshot: { forEach: (cb: (docSnap: any) => void) => void }): TerritoryState[] {
  const territories: TerritoryState[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const polygon = normalizeStoredCoordinates(data?.coordinates);
    if (!polygon || polygon.length === 0) {
      return;
    }
    territories.push({
      userId: typeof data?.userId === "string" ? data.userId : docSnap.id,
      coordinates: polygon,
      areaM2: typeof data?.areaM2 === "number" ? data.areaM2 : 0,
    });
  });

  return territories;
}

export function subscribeAllTerritories(
  onData: (territories: TerritoryState[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, "territories"),
    (snapshot) => {
      onData(parseTerritoriesSnapshot(snapshot));
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );
}

export async function updateTerritoryForRun(userId: string, points: TrackPoint[]): Promise<TerritoryState | null> {
  if (points.length < 2) {
    return null;
  }

  const routePoints = points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  const runBounds = expandBounds(computeBounds(routePoints), DEFAULT_BUFFER_METERS);
  const territoryRef = doc(db, "territories", userId);
  const existing = await getDoc(territoryRef);
  const existingPolygon = existing.exists() ? normalizeStoredCoordinates(existing.data()?.coordinates) : null;
  const existingBounds = existingPolygon ? computeBounds(existingPolygon) : null;

  const mergedBounds = existingBounds
    ? {
        minLat: Math.min(existingBounds.minLat, runBounds.minLat),
        maxLat: Math.max(existingBounds.maxLat, runBounds.maxLat),
        minLng: Math.min(existingBounds.minLng, runBounds.minLng),
        maxLng: Math.max(existingBounds.maxLng, runBounds.maxLng),
      }
    : runBounds;

  const polygon = boundsToPolygon(mergedBounds);
  const areaM2 = computeAreaMeters(mergedBounds);
  const version = existing.exists() ? (existing.data()?.version ?? 0) + 1 : 1;

  await setDoc(
    territoryRef,
    {
      userId,
      coordinates: polygon,
      areaM2,
      updatedAt: serverTimestamp(),
      version,
    },
    { merge: true }
  );

  const userRef = doc(db, "users", userId);
  try {
    await updateDoc(userRef, {
      totalArea: areaM2,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(
      userRef,
      {
        totalArea: areaM2,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { coordinates: polygon, areaM2 };
}
