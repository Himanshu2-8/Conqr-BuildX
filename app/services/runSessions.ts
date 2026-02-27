import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { TrackPoint } from "../hooks/useRunTracker";

type SaveRunInput = {
  userId: string;
  startedAtMs: number;
  endedAtMs: number;
  elapsedSeconds: number;
  distanceMeters: number;
  paceMinPerKm: number | null;
  points: TrackPoint[];
};

export type SaveRunResult = {
  sessionId: string;
  isValid: boolean;
  invalidReason: string | null;
};

function validateRun(input: SaveRunInput): { isValid: boolean; invalidReason: string | null } {
  if (input.elapsedSeconds < 10) {
    return { isValid: false, invalidReason: "Duration too short (<10s)" };
  }
  if (input.distanceMeters < 15) {
    return { isValid: false, invalidReason: "Distance too short (<15m)" };
  }
  if (input.points.length < 3) {
    return { isValid: false, invalidReason: "Not enough GPS points (<3)" };
  }
  return { isValid: true, invalidReason: null };
}

export async function saveRunSession(input: SaveRunInput): Promise<SaveRunResult> {
  const { isValid, invalidReason } = validateRun(input);

  const sessionRef = await addDoc(collection(db, "sessions"), {
    userId: input.userId,
    startedAt: new Date(input.startedAtMs),
    endedAt: new Date(input.endedAtMs),
    durationSec: input.elapsedSeconds,
    distanceM: input.distanceMeters,
    paceMinPerKm: input.paceMinPerKm ?? null,
    pointsCount: input.points.length,
    claimedAreaDeltaM2: 0,
    isValid,
    invalidReason,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.points.length > 0) {
    const batch = writeBatch(db);
    input.points.forEach((point, index) => {
      const pointRef = doc(collection(db, "sessions", sessionRef.id, "gps_points"));
      batch.set(pointRef, {
        seqNo: index + 1,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        speed: point.speed,
        timestamp: new Date(point.timestamp),
        isValid: true,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  if (isValid) {
    const userRef = doc(db, "users", input.userId);
    try {
      await updateDoc(userRef, {
        totalDistance: increment(input.distanceMeters),
        updatedAt: serverTimestamp(),
      });
    } catch {
      await setDoc(
        userRef,
        {
          totalDistance: input.distanceMeters,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  return {
    sessionId: sessionRef.id,
    isValid,
    invalidReason,
  };
}

export async function updateSessionClaimedArea(sessionId: string, claimedAreaDeltaM2: number): Promise<void> {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, {
    claimedAreaDeltaM2: Math.max(claimedAreaDeltaM2, 0),
    updatedAt: serverTimestamp(),
  });
}
