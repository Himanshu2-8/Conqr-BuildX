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
import type { ValidationResult } from "../utils/cheatDetector";
import type { ActivityType } from "../types/activity";

type SaveRunInput = {
  userId: string;
  startedAtMs: number;
  endedAtMs: number;
  elapsedSeconds: number;
  distanceMeters: number;
  paceMinPerKm: number | null;
  points: TrackPoint[];
  validation: ValidationResult;
  activityType: ActivityType;
};

export type SaveRunResult = {
  sessionId: string;
  isValid: boolean;
  invalidReason: string | null;
  validation: ValidationResult;
  activityType: ActivityType;
};

function validateRun(input: SaveRunInput): { isValid: boolean; invalidReason: string | null } {
  if (input.elapsedSeconds < 10) {
    return { isValid: false, invalidReason: "Duration too short (<10s)" };
  }
  if (input.distanceMeters < 15) {
    return { isValid: false, invalidReason: "Distance too short (<15m)" };
  }
  if (input.points.length < 2) {
    return { isValid: false, invalidReason: "Not enough GPS points (<2)" };
  }
  return { isValid: true, invalidReason: null };
}

export async function saveRunSession(input: SaveRunInput): Promise<SaveRunResult> {
  const basicCheck = validateRun(input);
  const validationIsValid = input.validation.status === "valid";
  const isValid = basicCheck.isValid && validationIsValid;
  const invalidReason = basicCheck.invalidReason ?? (validationIsValid ? null : input.validation.reasons.join(", "));

  const sessionRef = await addDoc(collection(db, "sessions"), {
    userId: input.userId,
    startedAt: new Date(input.startedAtMs),
    endedAt: new Date(input.endedAtMs),
    durationSec: input.elapsedSeconds,
    distanceM: input.distanceMeters,
    paceMinPerKm: input.paceMinPerKm ?? null,
    pointsCount: input.points.length,
    claimedAreaDeltaM2: 0,
    activityType: input.activityType,
    isValid,
    invalidReason,
    validation: {
      status: input.validation.status,
      confidence: input.validation.confidence,
      reasons: input.validation.reasons,
      updated_at: input.validation.updated_at,
      details: {
        features: input.validation.features,
        flagged_segments: input.validation.flagged_segments,
      },
    },
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
    validation: input.validation,
    activityType: input.activityType,
  };
}

export async function updateSessionClaimedArea(sessionId: string, claimedAreaDeltaM2: number): Promise<void> {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, {
    claimedAreaDeltaM2: Math.max(claimedAreaDeltaM2, 0),
    updatedAt: serverTimestamp(),
  });
}
