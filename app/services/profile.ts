import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../lib/firebase";

export type UserProfile = {
  uid: string;
  email: string;
  username: string;
  city: string;
  collegeName: string;
  avatarUrl: string;
  totalDistance: number;
  totalArea: number;
  streak: number;
};

export type UpdateProfileInput = {
  username: string;
  city: string;
  collegeName: string;
};

function emptyProfile(uid: string, email: string): UserProfile {
  return {
    uid,
    email,
    username: "",
    city: "",
    collegeName: "",
    avatarUrl: "",
    totalDistance: 0,
    totalArea: 0,
    streak: 0,
  };
}

export async function fetchUserProfile(uid: string, email: string): Promise<UserProfile> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const profile = emptyProfile(uid, email);
    await setDoc(
      userRef,
      {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return profile;
  }

  const data = snap.data();
  return {
    uid,
    email: typeof data?.email === "string" ? data.email : email,
    username: typeof data?.username === "string" ? data.username : "",
    city: typeof data?.city === "string" ? data.city : "",
    collegeName: typeof data?.collegeName === "string" ? data.collegeName : "",
    avatarUrl: typeof data?.avatarUrl === "string" ? data.avatarUrl : "",
    totalDistance: typeof data?.totalDistance === "number" ? data.totalDistance : 0,
    totalArea: typeof data?.totalArea === "number" ? data.totalArea : 0,
    streak: typeof data?.streak === "number" ? data.streak : 0,
  };
}

export async function updateUserProfile(uid: string, input: UpdateProfileInput): Promise<void> {
  const userRef = doc(db, "users", uid);
  const payload = {
    username: input.username.trim(),
    usernameLower: input.username.trim().toLowerCase(),
    city: input.city.trim(),
    collegeName: input.collegeName.trim(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(userRef, payload);
  } catch {
    await setDoc(
      userRef,
      {
        uid,
        email: auth.currentUser?.email ?? "",
        avatarUrl: "",
        totalDistance: 0,
        totalArea: 0,
        streak: 0,
        createdAt: serverTimestamp(),
        ...payload,
      },
      { merge: true }
    );
  }

  if (auth.currentUser && payload.username) {
    await updateProfile(auth.currentUser, { displayName: payload.username });
  }
}
