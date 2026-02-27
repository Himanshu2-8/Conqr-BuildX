import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

type SessionDoc = {
  distanceM?: unknown;
  claimedAreaDeltaM2?: unknown;
  isValid?: unknown;
  startedAt?: unknown;
};

export type QuestProgress = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
  completed: boolean;
};

export type BadgeState = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
};

export type MissionsSummary = {
  quests: QuestProgress[];
  badges: BadgeState[];
  streakDays: number;
};

const DAILY_ROUTE_TARGET_M = 5000;
const ZONE_WEEKLY_TARGET_M2 = 2500;

function asDate(value: unknown): Date | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (!("toDate" in value) || typeof (value as { toDate?: unknown }).toDate !== "function") {
    return null;
  }
  return (value as { toDate: () => Date }).toDate();
}

function getDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekStart(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

function computeStreak(dayKeys: Set<string>, today = new Date()) {
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  while (dayKeys.has(getDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function fetchMissionsSummary(userId: string): Promise<MissionsSummary> {
  const sessionsQ = query(collection(db, "sessions"), where("userId", "==", userId), orderBy("startedAt", "desc"));
  const sessionsSnap = await getDocs(sessionsQ);

  const todayKey = getDayKey(new Date());
  const weekStart = getWeekStart();

  let todayDistanceM = 0;
  let weekAreaM2 = 0;
  let totalDistanceM = 0;
  let totalAreaM2 = 0;
  let validRunCount = 0;
  const runDayKeys = new Set<string>();

  sessionsSnap.forEach((docSnap) => {
    const data = docSnap.data() as SessionDoc;
    const isValid = data.isValid === true;
    if (!isValid) {
      return;
    }

    const startedAt = asDate(data.startedAt);
    const distanceM = typeof data.distanceM === "number" ? data.distanceM : 0;
    const areaM2 = typeof data.claimedAreaDeltaM2 === "number" ? data.claimedAreaDeltaM2 : 0;

    validRunCount += 1;
    totalDistanceM += distanceM;
    totalAreaM2 += areaM2;

    if (startedAt) {
      const dayKey = getDayKey(startedAt);
      runDayKeys.add(dayKey);
      if (dayKey === todayKey) {
        todayDistanceM += distanceM;
      }
      if (startedAt >= weekStart) {
        weekAreaM2 += areaM2;
      }
    }
  });

  const streakDays = computeStreak(runDayKeys);

  const quests: QuestProgress[] = [
    {
      id: "daily_route",
      title: "Daily Route",
      description: "Complete a 5 km route today",
      progress: Math.min(todayDistanceM, DAILY_ROUTE_TARGET_M),
      target: DAILY_ROUTE_TARGET_M,
      unit: "m",
      completed: todayDistanceM >= DAILY_ROUTE_TARGET_M,
    },
    {
      id: "streak_quest",
      title: "Streak Quest",
      description: "Run 3 days in a row",
      progress: Math.min(streakDays, 3),
      target: 3,
      unit: "days",
      completed: streakDays >= 3,
    },
    {
      id: "zone_challenge",
      title: "Zone Challenge",
      description: "Claim 2,500 m2 this week",
      progress: Math.min(weekAreaM2, ZONE_WEEKLY_TARGET_M2),
      target: ZONE_WEEKLY_TARGET_M2,
      unit: "m2",
      completed: weekAreaM2 >= ZONE_WEEKLY_TARGET_M2,
    },
  ];

  const badges: BadgeState[] = [
    {
      id: "first_run",
      title: "First Run",
      description: "Complete your first valid run",
      unlocked: validRunCount >= 1,
    },
    {
      id: "distance_25k",
      title: "25K Explorer",
      description: "Reach 25 km total distance",
      unlocked: totalDistanceM >= 25000,
    },
    {
      id: "zone_1k",
      title: "Zone Rookie",
      description: "Claim 1,000 m2 territory",
      unlocked: totalAreaM2 >= 1000,
    },
  ];

  return {
    quests,
    badges,
    streakDays,
  };
}
