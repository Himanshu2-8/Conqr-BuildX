import React, { useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { useEntranceAnim } from "../hooks/useEntranceAnim";
import { AppLogo } from "../ui/AppLogo";

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const passwordRef = React.useRef<TextInput | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const brandAnim = useEntranceAnim(0, 24);
  const cardAnim = useEntranceAnim(120, 24);

  const onLogin = async () => {
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);

    if (!res.success) {
      Alert.alert("Login failed", res.message ?? "Something went wrong");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.brand, brandAnim]}>
          <AppLogo width={112} height={60} />
          <Text style={styles.brandTitle}>Conqr</Text>
          <Text style={styles.brandSubtitle}>Claim your miles, one run at a time.</Text>
        </Animated.View>

        <Animated.View style={cardAnim}>
        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardAppearance="dark"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              selectionColor="#DC2626"
              style={styles.input}
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="********"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              keyboardAppearance="dark"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              selectionColor="#DC2626"
              style={styles.input}
              ref={passwordRef}
              onSubmitEditing={onLogin}
            />
          </View>

          <Pressable
            android_ripple={{ color: "rgba(255,255,255,0.12)" }}
            hitSlop={10}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.primaryButtonDisabled]}
            onPress={onLogin}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? "Logging in..." : "Login"}</Text>
          </Pressable>

          <Pressable
            android_ripple={{ color: "rgba(255,255,255,0.10)" }}
            hitSlop={10}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate("Signup")}
          >
            <Text style={styles.secondaryButtonText}>Create account</Text>
          </Pressable>
        </LinearGradient>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  container: {
    flexGrow: 1,
    padding: 16,
    justifyContent: "center",
    gap: 14,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  brand: {
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.35)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#AEB7C9",
  },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D1D5DB",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.35)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  primaryButton: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.45)",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  secondaryButtonText: {
    color: "#FCA5A5",
    fontSize: 15,
    fontWeight: "700",
  },
});
