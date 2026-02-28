import {
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { ActivityType } from "../types/activity";

export type CityBattleRow = {
  city: string;
  weekKey: string;
  score: number;
  totalRuns: number;
  updatedAtLabel: string;
};

// Cycling generally covers more distance than walking/running, so we use a lower distance weight to normalize points.
export const DISTANCE_WEIGHT_BY_ACTIVITY: Record<ActivityType, number> = {
  walking: 1,
  cycling: 0.55,
};

function normalizeCity(city: string | null | undefined) {
  const trimmed = (city ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Unknown";
}

function cityDocId(weekKey: string, city: string) {
  return `${weekKey}__${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function formatUpdatedAt(raw: unknown) {
  if (!raw || typeof raw !== "object" || !("toDate" in raw) || typeof (raw as { toDate?: unknown }).toDate !== "function") {
    return "-";
  }
  return (raw as { toDate: () => Date }).toDate().toLocaleTimeString();
}

export function getCurrentWeekKey(now = new Date()) {
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function computeRunScore(claimedAreaDeltaM2: number, distanceM: number, activityType: ActivityType) {
  const distanceWeight = DISTANCE_WEIGHT_BY_ACTIVITY[activityType];
  return Math.max(0, claimedAreaDeltaM2) + Math.max(0, distanceM) * distanceWeight;
}

export async function fetchUserCity(userId: string): Promise<string> {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return "Unknown";
  }
  const rawCity = userSnap.data()?.city;
  return typeof rawCity === "string" ? normalizeCity(rawCity) : "Unknown";
}

type RecordRunCityScoreInput = {
  userId: string;
  sessionId: string;
  activityType: ActivityType;
  distanceM: number;
  claimedAreaDeltaM2: number;
};

export async function recordRunCityScore(input: RecordRunCityScoreInput): Promise<number> {
  const city = await fetchUserCity(input.userId);
  const weekKey = getCurrentWeekKey();
  const runScore = computeRunScore(input.claimedAreaDeltaM2, input.distanceM, input.activityType);

  const battleRef = doc(db, "city_weekly_scores", cityDocId(weekKey, city));
  const battleSnapshot = await getDoc(battleRef);

  if (battleSnapshot.exists()) {
    await updateDoc(battleRef, {
      score: increment(runScore),
      totalRuns: increment(1),
      updatedAt: serverTimestamp(),
      lastSessionId: input.sessionId,
      lastActivityType: input.activityType,
    });
  } else {
    await setDoc(
      battleRef,
      {
        city,
        weekKey,
        score: runScore,
        totalRuns: 1,
        updatedAt: serverTimestamp(),
        lastSessionId: input.sessionId,
        lastActivityType: input.activityType,
      },
      { merge: true }
    );
  }

  return runScore;
}

export function subscribeWeeklyCityBattle(
  onData: (rows: CityBattleRow[]) => void,
  onError?: (error: Error) => void
) {
  const weekKey = getCurrentWeekKey();
  const battleQuery = query(
    collection(db, "city_weekly_scores"),
    where("weekKey", "==", weekKey),
    orderBy("score", "desc"),
    limit(20)
  );

  return onSnapshot(
    battleQuery,
    (snapshot) => {
      const rows: CityBattleRow[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          city: typeof data.city === "string" ? data.city : "Unknown",
          weekKey,
          score: typeof data.score === "number" ? data.score : 0,
          totalRuns: typeof data.totalRuns === "number" ? data.totalRuns : 0,
          updatedAtLabel: formatUpdatedAt(data.updatedAt),
        };
      });
      onData(rows);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );
}
