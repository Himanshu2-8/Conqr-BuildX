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
        const authListener = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (!mounted) {
                return;
            }
            setSession(newSession);
            setUser(newSession?.user ?? null);
        });

        supabase.auth
            .getSession()
            .then(({ data, error }) => {
                if (!mounted) {
                    return;
                }
                if (error) {
                    console.error("getSession failed:", error.message);
                    setSession(null);
                    setUser(null);
                } else {
                    setSession(data.session);
                    setUser(data.session?.user ?? null);
                }
            })
            .catch((err: unknown) => {
                if (!mounted) {
                    return;
                }
                const message = err instanceof Error ? err.message : "Unknown auth initialization error";
                console.error("getSession exception:", message);
                setSession(null);
                setUser(null);
            })
            .finally(() => {
                if (!mounted) {
                    return;
                }
                setLoading(false);
            });

        return () => {
            mounted = false;
            authListener.data.subscription.unsubscribe();
        };
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
                const { data: existingProfile, error: profileReadError } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("id", userId)
                    .maybeSingle();

                if (profileReadError) {
                    console.error("profile read failed on signup:", profileReadError.message);
                }

                if (!existingProfile) {
                    const { error: profileUpsertError } = await supabase.from("profiles").upsert({
                        id: userId,
                        username: cleanUsername ?? `user_${userId.slice(0, 8)}`,
                    });
                    if (profileUpsertError) {
                        console.error("profile upsert failed on signup:", profileUpsertError.message);
                    }
                }
            }

            return {
                success: true,
                needsEmailConfirmation: !hasSession,
                message: !hasSession
                    ? "Signup successful. Verify your email to continue."
                    : "Signup successful.",
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

            const { data, error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            });

            if (error) return { success: false, message: error.message };

            const userId = data.user?.id;
            if (userId) {
                const { data: existingProfile, error: profileReadError } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("id", userId)
                    .maybeSingle();

                if (profileReadError) {
                    console.error("profile read failed on signin:", profileReadError.message);
                }

                if (!existingProfile) {
                    const { error: profileUpsertError } = await supabase.from("profiles").upsert({
                        id: userId,
                        username: `user_${userId.slice(0, 8)}`,
                    });
                    if (profileUpsertError) {
                        console.error("profile upsert failed on signin:", profileUpsertError.message);
                    }
                }
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
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("signout failed:", error.message);
            }
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
