import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";

export type TrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
};

type RunTrackerState = {
  isRunning: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  paceMinPerKm: number | null;
  points: TrackPoint[];
  error: string | null;
  startRun: () => Promise<boolean>;
  stopRun: () => void;
  resetRun: () => void;
};

const MIN_DISTANCE_DELTA_METERS = 3;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(a: TrackPoint, b: TrackPoint) {
  const R = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useRunTracker(): RunTrackerState {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const paceMinPerKm = useMemo(() => {
    if (distanceMeters < 1) {
      return null;
    }
    const distanceKm = distanceMeters / 1000;
    const elapsedMinutes = elapsedSeconds / 60;
    return elapsedMinutes / distanceKm;
  }, [distanceMeters, elapsedSeconds]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }
    };
  }, []);

  const startRun = async () => {
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied.");
        return false;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (position) => {
          const nextPoint: TrackPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
            speed: position.coords.speed ?? null,
            timestamp: position.timestamp,
          };

          setPoints((prev) => {
            if (prev.length === 0) {
              return [nextPoint];
            }

            const lastPoint = prev[prev.length - 1];
            const segmentDistance = haversineMeters(lastPoint, nextPoint);
            if (segmentDistance >= MIN_DISTANCE_DELTA_METERS) {
              setDistanceMeters((d) => d + segmentDistance);
              return [...prev, nextPoint];
            }
            return prev;
          });
        }
      );

      setIsRunning(true);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start GPS tracking";
      setError(message);
      return false;
    }
  };

  const stopRun = () => {
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
  };

  const resetRun = () => {
    stopRun();
    setElapsedSeconds(0);
    setDistanceMeters(0);
    setPoints([]);
    setError(null);
  };

  return {
    isRunning,
    elapsedSeconds,
    distanceMeters,
    paceMinPerKm,
    points,
    error,
    startRun,
    stopRun,
    resetRun,
  };
}
