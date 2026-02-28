import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import type { ActivityType } from "../types/activity";

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
  startRun: (activityType: ActivityType) => Promise<boolean>;
  stopRun: () => void;
  resetRun: () => void;
};

const MIN_DISTANCE_DELTA_METERS = 3;
const MAX_POINT_ACCURACY_METERS = 30;
const MAX_SEGMENT_DISTANCE_METERS = 120;
const MAX_SEGMENT_SPEED_BY_ACTIVITY: Record<ActivityType, number> = {
  walking: 7.5,
  cycling: 16,
};

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

function isPoorAccuracy(point: TrackPoint) {
  return typeof point.accuracy === "number" && point.accuracy > MAX_POINT_ACCURACY_METERS;
}

function isLikelyGpsJump(
  previous: TrackPoint,
  next: TrackPoint,
  segmentDistance: number,
  activityType: ActivityType
) {
  if (segmentDistance > MAX_SEGMENT_DISTANCE_METERS) {
    return true;
  }

  const dtSeconds = (next.timestamp - previous.timestamp) / 1000;
  if (dtSeconds <= 0) {
    return true;
  }

  const impliedSpeed = segmentDistance / dtSeconds;
  return impliedSpeed > MAX_SEGMENT_SPEED_BY_ACTIVITY[activityType];
}

export function useRunTracker(): RunTrackerState {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const activityTypeRef = useRef<ActivityType>("walking");

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

  const startRun = async (activityType: ActivityType) => {
    setError(null);
    activityTypeRef.current = activityType;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied.");
        return false;
      }

      setElapsedSeconds(0);
      setDistanceMeters(0);
      setPoints([]);

      try {
        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const initialPoint: TrackPoint = {
          latitude: initialPosition.coords.latitude,
          longitude: initialPosition.coords.longitude,
          accuracy: initialPosition.coords.accuracy ?? null,
          speed: initialPosition.coords.speed ?? null,
          timestamp: initialPosition.timestamp,
        };
        if (!isPoorAccuracy(initialPoint)) {
          setPoints([initialPoint]);
        }
      } catch {
        setError("Unable to get initial location. Tracking will continue when GPS updates arrive.");
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
            if (isPoorAccuracy(nextPoint)) {
              return prev;
            }

            if (prev.length === 0) {
              return [nextPoint];
            }

            const lastPoint = prev[prev.length - 1];
            const segmentDistance = haversineMeters(lastPoint, nextPoint);
            if (
              segmentDistance >= MIN_DISTANCE_DELTA_METERS &&
              !isLikelyGpsJump(lastPoint, nextPoint, segmentDistance, activityTypeRef.current)
            ) {
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
    activityTypeRef.current = "walking";
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
