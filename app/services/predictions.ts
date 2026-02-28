import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// ── Types ───────────────────────────────────────────────────────────────

export type PredictionMetric = "distance" | "pace" | "area";

export type PredictionStatus = "active" | "hit" | "missed" | "cancelled";

export type Prediction = {
  id: string;
  userId: string;
  metric: PredictionMetric;
  predictedValue: number; // m for distance, min/km for pace, m2 for area
  tolerancePct: number; // e.g. 10 means ±10 %
  stakeAreaM2: number; // territory at risk
  bonusMultiplier: number; // bonus territory multiplier on hit
  status: PredictionStatus;
  actualValue: number | null;
  sessionId: string | null;
  bonusAreaM2: number; // territory gained on hit (or lost on miss)
  createdAt: Date | null;
  resolvedAt: Date | null;
  // Friend challenge fields
  challengeTargetUserId: string | null;
  challengeTargetUsername: string | null;
  challengeAccepted: boolean;
};

// ── Constants ───────────────────────────────────────────────────────────

const PREDICTIONS_COL = "predictions";

const DEFAULT_TOLERANCE_PCT = 15; // ±15 % window to hit
const DEFAULT_BONUS_MULTIPLIER = 1.5; // 1.5× territory on hit
const BASE_STAKE_FRACTION = 0.05; // risk 5 % of total territory

// ── Helpers ─────────────────────────────────────────────────────────────

function getDateField(raw: unknown): Date | null {
  if (!raw || typeof raw !== "object") return null;
  const maybe = raw as { toDate?: unknown };
  if (typeof maybe.toDate === "function") return (maybe.toDate as () => Date)();
  return null;
}

function parsePrediction(docSnap: any): Prediction {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    userId: d?.userId ?? "",
    metric: d?.metric ?? "distance",
    predictedValue: typeof d?.predictedValue === "number" ? d.predictedValue : 0,
    tolerancePct: typeof d?.tolerancePct === "number" ? d.tolerancePct : DEFAULT_TOLERANCE_PCT,
    stakeAreaM2: typeof d?.stakeAreaM2 === "number" ? d.stakeAreaM2 : 0,
    bonusMultiplier: typeof d?.bonusMultiplier === "number" ? d.bonusMultiplier : DEFAULT_BONUS_MULTIPLIER,
    status: (["active", "hit", "missed", "cancelled"] as PredictionStatus[]).includes(d?.status)
      ? d.status
      : "active",
    actualValue: typeof d?.actualValue === "number" ? d.actualValue : null,
    sessionId: typeof d?.sessionId === "string" ? d.sessionId : null,
    bonusAreaM2: typeof d?.bonusAreaM2 === "number" ? d.bonusAreaM2 : 0,
    createdAt: getDateField(d?.createdAt),
    resolvedAt: getDateField(d?.resolvedAt),
    challengeTargetUserId: typeof d?.challengeTargetUserId === "string" ? d.challengeTargetUserId : null,
    challengeTargetUsername: typeof d?.challengeTargetUsername === "string" ? d.challengeTargetUsername : null,
    challengeAccepted: !!d?.challengeAccepted,
  };
}

// ── Public API ──────────────────────────────────────────────────────────

export function computeStakeArea(currentTotalAreaM2: number): number {
  return Math.max(Math.round(currentTotalAreaM2 * BASE_STAKE_FRACTION), 50);
}

export function computeBonusArea(stakeAreaM2: number): number {
  return Math.round(stakeAreaM2 * DEFAULT_BONUS_MULTIPLIER);
}

/**
 * Create a new prediction before a run.
 */
export async function createPrediction(input: {
  userId: string;
  metric: PredictionMetric;
  predictedValue: number;
  currentTotalAreaM2: number;
  challengeTargetUserId?: string | null;
  challengeTargetUsername?: string | null;
}): Promise<Prediction> {
  const stakeAreaM2 = computeStakeArea(input.currentTotalAreaM2);
  const docRef = await addDoc(collection(db, PREDICTIONS_COL), {
    userId: input.userId,
    metric: input.metric,
    predictedValue: input.predictedValue,
    tolerancePct: DEFAULT_TOLERANCE_PCT,
    stakeAreaM2,
    bonusMultiplier: DEFAULT_BONUS_MULTIPLIER,
    status: "active",
    actualValue: null,
    sessionId: null,
    bonusAreaM2: 0,
    createdAt: serverTimestamp(),
    resolvedAt: null,
    challengeTargetUserId: input.challengeTargetUserId ?? null,
    challengeTargetUsername: input.challengeTargetUsername ?? null,
    challengeAccepted: !input.challengeTargetUserId, // auto-accepted if solo
  });
  const snap = await getDoc(docRef);
  return parsePrediction(snap);
}

/**
 * Evaluate a prediction against the actual run stats.
 * Returns the resolved prediction with hit/miss status and bonus/penalty area.
 */
export async function resolvePrediction(
  predictionId: string,
  sessionId: string,
  actualValues: { distanceM: number; paceMinPerKm: number | null; areaM2: number }
): Promise<Prediction> {
  const predRef = doc(db, PREDICTIONS_COL, predictionId);
  const snap = await getDoc(predRef);
  if (!snap.exists()) throw new Error("Prediction not found");

  const pred = parsePrediction(snap);
  if (pred.status !== "active") return pred;

  let actual: number;
  switch (pred.metric) {
    case "distance":
      actual = actualValues.distanceM;
      break;
    case "pace":
      actual = actualValues.paceMinPerKm ?? 0;
      break;
    case "area":
      actual = actualValues.areaM2;
      break;
    default:
      actual = 0;
  }

  const lowerBound = pred.predictedValue * (1 - pred.tolerancePct / 100);
  const upperBound = pred.predictedValue * (1 + pred.tolerancePct / 100);

  // For pace, lower is better so we still just check the window
  const isHit = actual >= lowerBound && actual <= upperBound;
  const bonusAreaM2 = isHit ? computeBonusArea(pred.stakeAreaM2) : -pred.stakeAreaM2;

  await updateDoc(predRef, {
    status: isHit ? "hit" : "missed",
    actualValue: actual,
    sessionId,
    bonusAreaM2,
    resolvedAt: serverTimestamp(),
  });

  return {
    ...pred,
    status: isHit ? "hit" : "missed",
    actualValue: actual,
    sessionId,
    bonusAreaM2,
    resolvedAt: new Date(),
  };
}

/**
 * Cancel an active prediction (e.g. if user decides not to run).
 */
export async function cancelPrediction(predictionId: string): Promise<void> {
  const predRef = doc(db, PREDICTIONS_COL, predictionId);
  await updateDoc(predRef, {
    status: "cancelled",
    resolvedAt: serverTimestamp(),
  });
}

/**
 * Fetch the user's active (unresolved) prediction, if any.
 */
export async function fetchActivePrediction(userId: string): Promise<Prediction | null> {
  const q = query(
    collection(db, PREDICTIONS_COL),
    where("userId", "==", userId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return parsePrediction(snap.docs[0]);
}

/**
 * Fetch recent predictions (resolved + active) for a user.
 */
export async function fetchPredictionHistory(userId: string, maxCount = 10): Promise<Prediction[]> {
  const q = query(
    collection(db, PREDICTIONS_COL),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(parsePrediction);
}

/**
 * Subscribe to a user's active prediction in real time.
 */
export function subscribeActivePrediction(
  userId: string,
  onData: (prediction: Prediction | null) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, PREDICTIONS_COL),
    where("userId", "==", userId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(null);
      } else {
        onData(parsePrediction(snapshot.docs[0]));
      }
    },
    (error) => {
      onError?.(error as Error);
    }
  );
}

/**
 * Fetch pending challenges sent to a user (as target).
 */
export async function fetchIncomingChallenges(userId: string): Promise<Prediction[]> {
  const q = query(
    collection(db, PREDICTIONS_COL),
    where("challengeTargetUserId", "==", userId),
    where("status", "==", "active"),
    where("challengeAccepted", "==", false),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(parsePrediction);
}

/**
 * Accept a friend challenge prediction.
 */
export async function acceptChallenge(predictionId: string): Promise<void> {
  const predRef = doc(db, PREDICTIONS_COL, predictionId);
  await updateDoc(predRef, { challengeAccepted: true });
}

/**
 * Format a metric value for display.
 */
export function formatPredictionValue(metric: PredictionMetric, value: number): string {
  switch (metric) {
    case "distance":
      return `${(value / 1000).toFixed(2)} km`;
    case "pace": {
      const mins = Math.floor(value);
      const secs = Math.round((value - mins) * 60);
      return `${mins}:${String(secs).padStart(2, "0")} /km`;
    }
    case "area":
      return `${Math.round(value).toLocaleString()} m²`;
    default:
      return String(value);
  }
}

/**
 * Get the display name for a metric.
 */
export function getMetricLabel(metric: PredictionMetric): string {
  switch (metric) {
    case "distance":
      return "Distance";
    case "pace":
      return "Pace";
    case "area":
      return "Territory Area";
  }
}

/**
 * Get the input placeholder / unit hint for a metric.
 */
export function getMetricUnit(metric: PredictionMetric): string {
  switch (metric) {
    case "distance":
      return "km";
    case "pace":
      return "min/km";
    case "area":
      return "m²";
  }
}
