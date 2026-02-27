import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";

export function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    setLoading(true);
    const res = await signUp({ email, password, username });
    setLoading(false);

    if (!res.success) {
      Alert.alert("Signup failed", res.message ?? "Something went wrong");
      return;
    }

    Alert.alert("Success", "Account created.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>Conqr</Text>
          <Text style={styles.brandSubtitle}>Create your account to get started.</Text>
        </View>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join the run and build your streak.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              placeholder="Optional nickname"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
            />
          </View>

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
              placeholder="At least 6 characters"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
          </View>

          <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={onSignup} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? "Creating..." : "Create account"}</Text>
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
});
