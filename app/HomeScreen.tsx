import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Hey {user?.displayName || "Runner"}</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today’s focus</Text>
          <Text style={styles.cardSubtitle}>Stay consistent. Every run adds territory.</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Runs</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>0.0 km</Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Run")}>
            <Text style={styles.primaryButtonText}>Start Run</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={signOut}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5f5",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: "#e2e8f0",
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#22c55e",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#052e16",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "600",
  },
});
