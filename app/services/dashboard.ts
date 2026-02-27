import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

type LastRun = {
  distanceM: number;
  durationSec: number;
  isValid: boolean;
  startedAtLabel: string;
} | null;

export type DashboardSummary = {
  totalAreaM2: number;
  totalRuns: number;
  totalDistanceM: number;
  lastRun: LastRun;
};

function formatStartedAt(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof (value as { toDate?: unknown }).toDate !== "function") {
    return "-";
  }
  const date = (value as { toDate: () => Date }).toDate();
  return date.toLocaleString();
}

export async function fetchDashboardSummary(userId: string): Promise<DashboardSummary> {
  const territoryRef = doc(db, "territories", userId);
  const territorySnap = await getDoc(territoryRef);
  const totalAreaM2 =
    territorySnap.exists() && typeof territorySnap.data()?.areaM2 === "number" ? territorySnap.data().areaM2 : 0;

  const sessionsQ = query(collection(db, "sessions"), where("userId", "==", userId), orderBy("startedAt", "desc"));
  const sessionsSnap = await getDocs(sessionsQ);

  let totalRuns = 0;
  let totalDistanceM = 0;
  let lastRun: LastRun = null;

  sessionsSnap.docs.forEach((docSnap, index) => {
    const data = docSnap.data();
    const isValid = data.isValid !== false;
    const distanceM = typeof data.distanceM === "number" ? data.distanceM : 0;
    const durationSec = typeof data.durationSec === "number" ? data.durationSec : 0;

    if (isValid) {
      totalRuns += 1;
      totalDistanceM += distanceM;
    }

    if (index === 0) {
      lastRun = {
        distanceM,
        durationSec,
        isValid,
        startedAtLabel: formatStartedAt(data.startedAt),
      };
    }
  });

  return {
    totalAreaM2,
    totalRuns,
    totalDistanceM,
    lastRun,
  };
}
