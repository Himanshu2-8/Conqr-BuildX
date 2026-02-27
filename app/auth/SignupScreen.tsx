import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>Conqr</Text>
          <Text style={styles.brandSubtitle}>Create your account to get started.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join the run and build your streak.</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              placeholder="Optional nickname"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
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
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
          </View>
          <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={onSignup} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? "Creating..." : "Create account"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    gap: 24,
  },
  brand: {
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#cbd5f5",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
