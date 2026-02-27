import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

type SignUpInput = {
    email: string;
    password: string;
    username?: string;
};

type AuthContextType = {
    session: User | null;
    user: User | null;
    loading: boolean;
    signUp: (input: SignUpInput) => Promise<{ success: boolean; message?: string }>;
    signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<User | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const ensureUserProfile = async (currentUser: User, username?: string) => {
        const userRef = doc(db, "users", currentUser.uid);
        const existing = await getDoc(userRef);
        if (existing.exists()) {
            return;
        }

        await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email ?? "",
            username: username ?? currentUser.displayName ?? `user_${currentUser.uid.slice(0, 8)}`,
            avatarUrl: "",
            city: "",
            totalDistance: 0,
            totalArea: 0,
            streak: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setSession(firebaseUser);
            setUser(firebaseUser);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signUp: AuthContextType["signUp"] = async ({ email, password, username }) => {
        try {
            const cleanEmail = email.trim().toLowerCase();
            const cleanUsername = username?.trim();

            if (!cleanEmail || !password) {
                return { success: false, message: "Email and password are required." };
            }

            if (password.length < 6) {
                return { success: false, message: "Password must be at least 6 characters." };
            }

            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            if (cleanUsername) {
                await updateProfile(cred.user, { displayName: cleanUsername });
            }
            try {
                await ensureUserProfile(cred.user, cleanUsername);
            } catch (profileErr: unknown) {
                const profileMessage =
                    profileErr instanceof Error ? profileErr.message : "Failed to create profile document";
                console.error("signup profile bootstrap failed:", profileMessage);
            }

            return {
                success: true,
                message: "Signup successful.",
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown signup error";
            console.error("signup exception:", message);
            return { success: false, message };
        }
    };
    const signIn: AuthContextType["signIn"] = async (email, password) => {
        try {
            const cleanEmail = email.trim().toLowerCase();

            if (!cleanEmail || !password) {
                return { success: false, message: "Email and password are required." };
            }

            const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            try {
                await ensureUserProfile(cred.user);
            } catch (profileErr: unknown) {
                const profileMessage =
                    profileErr instanceof Error ? profileErr.message : "Failed to ensure profile document";
                console.error("signin profile bootstrap failed:", profileMessage);
            }

            return { success: true };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown signin error";
            console.error("signin exception:", message);
            return { success: false, message };
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown signout error";
            console.error("signout exception:", message);
        }
    };

    const value = useMemo(
        () => ({ session, user, loading, signUp, signIn, signOut }),
        [session, user, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
