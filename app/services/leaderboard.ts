import {
  collection,
  documentId,
  getDocs,
  query,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type LeaderboardMetric = "area" | "distance";
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

export async function fetchLeaderboard(metric: LeaderboardMetric, period: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const periodStart = getPeriodStart(period);
  const sessionsQuery = query(
    collection(db, "sessions"),
    where("startedAt", ">=", Timestamp.fromDate(periodStart))
  );

  const sessionSnapshots = await getDocs(sessionsQuery);
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

    const rawValue = metric === "distance" ? data.distanceM : data.claimedAreaDeltaM2;
    const value = typeof rawValue === "number" ? rawValue : 0;
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
