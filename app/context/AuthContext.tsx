import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type SignUpInput = {
    email: string;
    password: string;
    username?: string;
};

type AuthContextType = {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signUp: (input: SignUpInput) => Promise<{ success: boolean; message?: string; needsEmailConfirmation?: boolean }>;
    signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    useEffect(() => {
        let mounted = true;
        let authListener: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;
        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) {
                return;
            }
            setSession(data.session);
            setUser(data.session?.user ?? null);
            setLoading(false);
            authListener = supabase.auth.onAuthStateChange((_event, newSession) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);
            });
        });
        return () => {
            mounted = false;
            if (authListener) {
                authListener.data.subscription.unsubscribe();
            }
        };
    }, []);
    const signUp: AuthContextType["signUp"] = async ({ email, password, username }) => {
        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = username?.trim();

        if (!cleanEmail || !password) {
            return { success: false, message: "Email and password are required." };
        }

        if (password.length < 6) {
            return { success: false, message: "Password must be at least 6 characters." };
        }

        const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
                data: { username: cleanUsername ?? null },
            },
        });

        if (error) return { success: false, message: error.message };

        const userId = data.user?.id;
        const hasSession = !!data.session;

        if (userId) {
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", userId)
                .maybeSingle();

            if (!existingProfile) {
                await supabase.from("profiles").upsert({
                    id: userId,
                    username: cleanUsername ?? `user_${userId.slice(0, 8)}`,
                });
            }
        }

        return {
            success: true,
            needsEmailConfirmation: !hasSession,
            message: !hasSession
                ? "Signup successful. Verify your email to continue."
                : "Signup successful.",
        };
    };
    const signIn: AuthContextType["signIn"] = async (email, password) => {
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail || !password) {
            return { success: false, message: "Email and password are required." };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
        });

        if (error) return { success: false, message: error.message };

        const userId = data.user?.id;
        if (userId) {
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", userId)
                .maybeSingle();

            if (!existingProfile) {
                await supabase.from("profiles").upsert({
                    id: userId,
                    username: `user_${userId.slice(0, 8)}`,
                });
            }
        }

        return { success: true };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
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
