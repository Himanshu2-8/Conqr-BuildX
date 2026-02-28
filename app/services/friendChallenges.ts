import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type FireTimestampLike = {
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
};

export type FriendChallengeParticipant = {
  userId: string;
  username: string;
  baselineDistanceM: number;
  joinedAtMs: number;
};

export type FriendChallenge = {
  id: string;
  inviteCode: string;
  hostUserId: string;
  hostUsername: string;
  durationMinutes: number;
  startsAtMs: number;
  endsAtMs: number;
  participantLimit: number;
  status: "waiting" | "active" | "completed";
  participants: FriendChallengeParticipant[];
};

type CreateFriendChallengeInput = {
  hostUserId: string;
  hostUsername: string;
  durationMinutes: number;
  baselineDistanceM: number;
};

type JoinFriendChallengeInput = {
  inviteCode: string;
  userId: string;
  username: string;
  baselineDistanceM: number;
};

const FRIEND_LIMIT = 4;

function toMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return Date.now();
  }
  const ts = value as FireTimestampLike;
  if (typeof ts.toMillis === "function") {
    return ts.toMillis();
  }
  if (typeof ts.seconds === "number") {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1_000_000);
  }
  return Date.now();
}

function sanitizeDurationMinutes(value: number) {
  const rounded = Math.round(value);
  return Math.max(5, Math.min(180, rounded));
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeParticipants(raw: unknown): FriendChallengeParticipant[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as {
        userId?: unknown;
        username?: unknown;
        baselineDistanceM?: unknown;
        joinedAtMs?: unknown;
      };
      if (typeof candidate.userId !== "string") {
        return null;
      }
      return {
        userId: candidate.userId,
        username:
          typeof candidate.username === "string" && candidate.username.trim()
            ? candidate.username.trim()
            : `Runner ${candidate.userId.slice(0, 4)}`,
        baselineDistanceM: typeof candidate.baselineDistanceM === "number" ? candidate.baselineDistanceM : 0,
        joinedAtMs: toMs(candidate.joinedAtMs),
      };
    })
    .filter((value): value is FriendChallengeParticipant => !!value);
}

function parseChallenge(docSnap: { id: string; data: () => any }): FriendChallenge | null {
  const data = docSnap.data();
  if (!data) {
    return null;
  }

  const participants = normalizeParticipants(data.participants);
  const startsAtMs = typeof data.startsAtMs === "number" && Number.isFinite(data.startsAtMs) ? data.startsAtMs : 0;
  const endsAtMs =
    typeof data.endsAtMs === "number" && Number.isFinite(data.endsAtMs)
      ? data.endsAtMs
      : startsAtMs > 0
        ? startsAtMs + sanitizeDurationMinutes(typeof data.durationMinutes === "number" ? data.durationMinutes : 30) * 60_000
        : 0;
  const computedStatus: "waiting" | "active" | "completed" =
    startsAtMs <= 0 ? "waiting" : Date.now() >= endsAtMs ? "completed" : "active";

  return {
    id: docSnap.id,
    inviteCode: typeof data.inviteCode === "string" ? data.inviteCode : "",
    hostUserId: typeof data.hostUserId === "string" ? data.hostUserId : "",
    hostUsername:
      typeof data.hostUsername === "string" && data.hostUsername.trim()
        ? data.hostUsername.trim()
        : "Host",
    durationMinutes: sanitizeDurationMinutes(typeof data.durationMinutes === "number" ? data.durationMinutes : 30),
    startsAtMs,
    endsAtMs,
    participantLimit:
      typeof data.participantLimit === "number" && Number.isFinite(data.participantLimit)
        ? data.participantLimit
        : FRIEND_LIMIT + 1,
    status:
      data.status === "waiting" || data.status === "completed" || data.status === "active"
        ? (data.status as "waiting" | "active" | "completed")
        : computedStatus,
    participants,
  };
}

export function formatChallengeTimeRemaining(challenge: FriendChallenge) {
  if (challenge.status === "waiting" || challenge.startsAtMs <= 0) {
    return "Waiting for host";
  }
  const msLeft = challenge.endsAtMs - Date.now();
  if (msLeft <= 0) {
    return "Finished";
  }
  const totalMinutes = Math.ceil(msLeft / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes}m left`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m left`;
}

export function buildFriendChallengeShareMessage(challenge: FriendChallenge) {
  return `Join my Conqr friends challenge.\nCode: ${challenge.inviteCode}\nTime: ${challenge.durationMinutes} minutes\nOpen Conqr and add this code in Friends.`;
}

export async function createFriendChallenge(input: CreateFriendChallengeInput): Promise<FriendChallenge> {
  const durationMinutes = sanitizeDurationMinutes(input.durationMinutes);
  const startsAtMs = 0;
  const endsAtMs = 0;
  const participant: FriendChallengeParticipant = {
    userId: input.hostUserId,
    username: input.hostUsername.trim() || "Host",
    baselineDistanceM: Math.max(0, input.baselineDistanceM),
    joinedAtMs: Date.now(),
  };

  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await getDocs(
      query(collection(db, "friend_challenges"), where("inviteCode", "==", inviteCode), limit(1))
    );
    if (existing.empty) {
      break;
    }
    inviteCode = generateInviteCode();
  }

  const docRef = await addDoc(collection(db, "friend_challenges"), {
    inviteCode,
    hostUserId: input.hostUserId,
    hostUsername: participant.username,
    durationMinutes,
    startsAtMs,
    endsAtMs,
    participantLimit: FRIEND_LIMIT + 1,
    participantIds: [input.hostUserId],
    participants: [participant],
    status: "waiting",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    inviteCode,
    hostUserId: input.hostUserId,
    hostUsername: participant.username,
    durationMinutes,
    startsAtMs,
    endsAtMs,
    participantLimit: FRIEND_LIMIT + 1,
    participants: [participant],
    status: "waiting",
  };
}

export async function joinFriendChallengeByCode(input: JoinFriendChallengeInput): Promise<FriendChallenge> {
  const cleanCode = input.inviteCode.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error("Enter a valid challenge code.");
  }

  const snapshot = await getDocs(
    query(collection(db, "friend_challenges"), where("inviteCode", "==", cleanCode), limit(1))
  );

  if (snapshot.empty) {
    throw new Error("Challenge not found.");
  }

  const docSnap = snapshot.docs[0];
  const challenge = parseChallenge(docSnap);
  if (!challenge) {
    throw new Error("Challenge data is invalid.");
  }
  if (challenge.status === "completed" || (challenge.endsAtMs > 0 && Date.now() >= challenge.endsAtMs)) {
    throw new Error("Challenge already ended.");
  }
  if (challenge.status !== "waiting") {
    throw new Error("Challenge already started.");
  }

  const alreadyJoined = challenge.participants.some((participant) => participant.userId === input.userId);
  if (alreadyJoined) {
    return challenge;
  }

  if (challenge.participants.length >= challenge.participantLimit) {
    throw new Error("This challenge already has the maximum 4 friends.");
  }

  const updatedParticipants = [
    ...challenge.participants,
    {
      userId: input.userId,
      username: input.username.trim() || `Runner ${input.userId.slice(0, 4)}`,
      baselineDistanceM: Math.max(0, input.baselineDistanceM),
      joinedAtMs: Date.now(),
    },
  ];

  await updateDoc(docSnap.ref, {
    participants: updatedParticipants,
    participantIds: updatedParticipants.map((participant) => participant.userId),
    updatedAt: serverTimestamp(),
  });

  return {
    ...challenge,
    participants: updatedParticipants,
  };
}

export async function startFriendChallenge(
  challengeId: string,
  hostUserId: string,
  participantDistanceByUserId: Record<string, number>
): Promise<void> {
  const docRef = doc(db, "friend_challenges", challengeId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Challenge not found.");
  }
  const challenge = parseChallenge(docSnap);
  if (!challenge) {
    throw new Error("Challenge data is invalid.");
  }
  if (challenge.hostUserId !== hostUserId) {
    throw new Error("Only the host can start this challenge.");
  }
  if (challenge.status !== "waiting") {
    throw new Error("Challenge already started.");
  }

  const startsAtMs = Date.now();
  const endsAtMs = startsAtMs + challenge.durationMinutes * 60_000;
  const participants = challenge.participants.map((participant) => ({
    ...participant,
    baselineDistanceM: participantDistanceByUserId[participant.userId] ?? participant.baselineDistanceM ?? 0,
  }));

  await updateDoc(docSnap.ref, {
    startsAtMs,
    endsAtMs,
    participants,
    status: "active",
    updatedAt: serverTimestamp(),
  });
}

export function subscribeFriendChallengesForUser(
  userId: string,
  onData: (challenges: FriendChallenge[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(collection(db, "friend_challenges"), where("participantIds", "array-contains", userId)),
    (snapshot) => {
      const rows = snapshot.docs
        .map((docSnap) => parseChallenge(docSnap))
        .filter((value): value is FriendChallenge => !!value)
        .sort((a, b) => b.endsAtMs - a.endsAtMs);
      onData(rows);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );
}
