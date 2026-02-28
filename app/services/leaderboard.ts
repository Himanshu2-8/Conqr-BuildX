import {
  collection,
  documentId,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { ActivityType } from "../types/activity";
import { DISTANCE_WEIGHT_BY_ACTIVITY } from "./cityBattle";

export type LeaderboardMetric = "area" | "distance" | "score";
export type LeaderboardPeriod = "daily" | "weekly";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  value: number;
};

type SessionDoc = {
  userId?: unknown;
  distanceM?: unknown;
  claimedAreaDeltaM2?: unknown;
  isValid?: unknown;
  activityType?: unknown;
};

type UserDoc = {
  username?: unknown;
};

function getPeriodStart(period: LeaderboardPeriod, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "weekly") {
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
  }

  return start;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

function parseSession(docSnap: QueryDocumentSnapshot<DocumentData>): SessionDoc {
  return docSnap.data() as SessionDoc;
}

function normalizedRunScore(data: SessionDoc): number {
  const distanceM = typeof data.distanceM === "number" ? data.distanceM : 0;
  const areaM2 = typeof data.claimedAreaDeltaM2 === "number" ? data.claimedAreaDeltaM2 : 0;
  const activityType: ActivityType = data.activityType === "cycling" ? "cycling" : "walking";
  const weight = DISTANCE_WEIGHT_BY_ACTIVITY[activityType];
  return Math.max(0, areaM2) + Math.max(0, distanceM) * weight;
}

async function aggregateLeaderboardFromSessionSnapshot(
  sessionSnapshots: QuerySnapshot<DocumentData>,
  metric: LeaderboardMetric
): Promise<LeaderboardRow[]> {
  const totals = new Map<string, number>();

  sessionSnapshots.forEach((docSnap) => {
    const data = parseSession(docSnap);
    const isValid = data.isValid === true;
    if (!isValid) {
      return;
    }
    const userId = typeof data.userId === "string" ? data.userId : null;
    if (!userId) {
      return;
    }

    let value = 0;
    if (metric === "distance") {
      value = typeof data.distanceM === "number" ? data.distanceM : 0;
    } else if (metric === "area") {
      value = typeof data.claimedAreaDeltaM2 === "number" ? data.claimedAreaDeltaM2 : 0;
    } else {
      value = normalizedRunScore(data);
    }

    totals.set(userId, (totals.get(userId) ?? 0) + value);
  });

  const sorted = [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return [];
  }

  const ids = sorted.map(([userId]) => userId);
  const usernames = new Map<string, string>();

  for (const batchIds of chunk(ids, 10)) {
    const usersQuery = query(collection(db, "users"), where(documentId(), "in", batchIds));
    const usersSnapshot = await getDocs(usersQuery);
    usersSnapshot.forEach((userSnap) => {
      const userData = userSnap.data() as UserDoc;
      usernames.set(
        userSnap.id,
        typeof userData.username === "string" && userData.username.trim().length > 0
          ? userData.username
          : `Runner ${userSnap.id.slice(0, 6)}`
      );
    });
  }

  return sorted.slice(0, 30).map(([userId, value], index) => ({
    rank: index + 1,
    userId,
    username: usernames.get(userId) ?? `Runner ${userId.slice(0, 6)}`,
    value,
  }));
}

export async function fetchLeaderboard(metric: LeaderboardMetric, period: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const periodStart = getPeriodStart(period);
  const sessionsQuery = query(
    collection(db, "sessions"),
    where("startedAt", ">=", Timestamp.fromDate(periodStart))
  );

  const sessionSnapshots = await getDocs(sessionsQuery);
  return aggregateLeaderboardFromSessionSnapshot(sessionSnapshots, metric);
}

export function subscribeLeaderboard(
  metric: LeaderboardMetric,
  period: LeaderboardPeriod,
  onData: (rows: LeaderboardRow[]) => void,
  onError?: (error: Error) => void
) {
  const periodStart = getPeriodStart(period);
  const sessionsQuery = query(collection(db, "sessions"), where("startedAt", ">=", Timestamp.fromDate(periodStart)));

  return onSnapshot(
    sessionsQuery,
    async (sessionSnapshots) => {
      try {
        const rows = await aggregateLeaderboardFromSessionSnapshot(sessionSnapshots, metric);
        onData(rows);
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
      }
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );
}
