import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type FriendRow = {
  uid: string;
  username: string;
  email: string;
  addedAt: Date | null;
};

type UserDoc = {
  username?: unknown;
  usernameLower?: unknown;
  email?: unknown;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function getDate(value: unknown): Date | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const maybe = value as { toDate?: unknown };
  if (typeof maybe.toDate !== "function") {
    return null;
  }
  return (maybe.toDate as () => Date)();
}

async function resolveUserByUsername(rawUsername: string) {
  const usernameInput = rawUsername.trim();
  const usernameLower = normalizeUsername(rawUsername);
  if (!usernameInput) {
    return null;
  }

  const byLower = await getDocs(
    query(collection(db, "users"), where("usernameLower", "==", usernameLower), limit(2))
  );
  if (!byLower.empty) {
    return byLower.docs[0];
  }

  const byExact = await getDocs(
    query(collection(db, "users"), where("username", "==", usernameInput), limit(2))
  );
  if (!byExact.empty) {
    return byExact.docs[0];
  }

  return null;
}

export async function addFriendByUsername(currentUserId: string, friendUsername: string): Promise<void> {
  const targetSnap = await resolveUserByUsername(friendUsername);
  if (!targetSnap) {
    throw new Error("No user found with that username.");
  }

  const targetId = targetSnap.id;
  if (targetId === currentUserId) {
    throw new Error("You cannot add yourself.");
  }

  const currentRef = doc(db, "users", currentUserId);
  const currentSnap = await getDoc(currentRef);
  if (!currentSnap.exists()) {
    throw new Error("Your profile is missing.");
  }

  const currentData = currentSnap.data() as UserDoc;
  const targetData = targetSnap.data() as UserDoc;
  const currentUsername =
    typeof currentData.username === "string" && currentData.username.trim().length > 0
      ? currentData.username.trim()
      : `Runner ${currentUserId.slice(0, 6)}`;
  const targetUsername =
    typeof targetData.username === "string" && targetData.username.trim().length > 0
      ? targetData.username.trim()
      : `Runner ${targetId.slice(0, 6)}`;
  const currentEmail = typeof currentData.email === "string" ? currentData.email : "";
  const targetEmail = typeof targetData.email === "string" ? targetData.email : "";

  const currentFriendRef = doc(db, "users", currentUserId, "friends", targetId);
  const targetFriendRef = doc(db, "users", targetId, "friends", currentUserId);

  const batch = writeBatch(db);
  batch.set(
    currentFriendRef,
    {
      uid: targetId,
      username: targetUsername,
      email: targetEmail,
      addedAt: serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    targetFriendRef,
    {
      uid: currentUserId,
      username: currentUsername,
      email: currentEmail,
      addedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

export function subscribeFriends(
  currentUserId: string,
  onData: (friends: FriendRow[]) => void,
  onError?: (error: Error) => void
) {
  const friendsQuery = query(collection(db, "users", currentUserId, "friends"), orderBy("username", "asc"));
  return onSnapshot(
    friendsQuery,
    (snapshot) => {
      const rows: FriendRow[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as {
          uid?: unknown;
          username?: unknown;
          email?: unknown;
          addedAt?: unknown;
        };
        const uid = typeof data.uid === "string" ? data.uid : docSnap.id;
        const username =
          typeof data.username === "string" && data.username.trim().length > 0
            ? data.username
            : `Runner ${uid.slice(0, 6)}`;
        return {
          uid,
          username,
          email: typeof data.email === "string" ? data.email : "",
          addedAt: getDate(data.addedAt),
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
