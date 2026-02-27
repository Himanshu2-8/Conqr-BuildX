import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>Conqr</Text>
          <Text style={styles.brandSubtitle}>Claim your miles, one run at a time.</Text>
        </View>

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
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="********"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
          </View>

          <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={onLogin} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? "Logging in..." : "Login"}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Signup")}>
            <Text style={styles.secondaryButtonText}>Create account</Text>
          </Pressable>
        </LinearGradient>
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
  },
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
