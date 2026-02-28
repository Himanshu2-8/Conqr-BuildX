import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "./context/AuthContext";
import { fetchUserProfile, updateUserProfile, type UserProfile } from "./services/profile";
import { fetchMissionsSummary, type MissionsSummary } from "./services/missions";
import { ActivityRings } from "./ui/ActivityRings";

export function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [missions, setMissions] = useState<MissionsSummary | null>(null);
  const [selectedRingId, setSelectedRingId] = useState<string>("move");

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextProfile, nextMissions] = await Promise.all([
        fetchUserProfile(user.uid, user.email ?? ""),
        fetchMissionsSummary(user.uid),
      ]);
      setProfile(nextProfile);
      setMissions(nextMissions);
      setUsername(nextProfile.username || user.displayName || "");
      setCity(nextProfile.city);
      setCollegeName(nextProfile.collegeName);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      Alert.alert("Profile error", message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const name = username?.trim() || user?.displayName || "Runner";
  const totalDistanceM = profile?.totalDistance ?? 0;
  const totalDistanceKm = totalDistanceM / 1000;
  const streakDays = missions?.streakDays ?? profile?.streak ?? 0;
  const estimatedCalories = Math.round(totalDistanceKm * 70); // simple demo estimate @70kg

  const moveGoalKcal = 500;
  const exerciseGoalKm = 5;
  const standGoalDays = 7;

  const rings = [
    {
      id: "move",
      label: "Move",
      valueLabel: `${estimatedCalories}/${moveGoalKcal} kcal`,
      progress: moveGoalKcal > 0 ? estimatedCalories / moveGoalKcal : 0,
      color: "#EF4444",
    },
    {
      id: "exercise",
      label: "Exercise",
      valueLabel: `${totalDistanceKm.toFixed(1)}/${exerciseGoalKm} km`,
      progress: exerciseGoalKm > 0 ? totalDistanceKm / exerciseGoalKm : 0,
      color: "#22C55E",
    },
    {
      id: "stand",
      label: "Stand",
      valueLabel: `${streakDays}/${standGoalDays} days`,
      progress: standGoalDays > 0 ? streakDays / standGoalDays : 0,
      color: "#38BDF8",
    },
  ];

  const onSave = async () => {
    if (!user) {
      Alert.alert("Profile", "Please sign in again.");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Validation", "Username is required.");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { username, city, collegeName });
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Personalize your identity and mission context.</Text>
        </View>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="account-circle-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>{name}</Text>
          </View>

          <ActivityRings rings={rings} selectedId={selectedRingId} onSelect={setSelectedRingId} />

          <View style={styles.quickStatsRow}>
            <View style={styles.quickStat}>
              <Text style={styles.quickLabel}>Territory</Text>
              <Text style={styles.quickValue}>{Math.round(profile?.totalArea ?? 0).toLocaleString()} m2</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickLabel}>Level</Text>
              <Text style={styles.quickValue}>{missions?.badges?.filter((b) => b.unlocked).length ?? 0} badges</Text>
            </View>
          </View>
          <Text style={styles.hint}>Tap a ring to focus it.</Text>
        </LinearGradient>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.readonly}>{user?.email ?? "-"}</Text>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholder="Your display name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholder="Your city"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>College</Text>
            <TextInput
              value={collegeName}
              onChangeText={setCollegeName}
              style={styles.input}
              placeholder="Your college or campus"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (saving || loading) && styles.disabled]}
            onPress={onSave}
            disabled={saving || loading}
          >
            <Text style={styles.saveText}>{saving ? "Saving..." : loading ? "Loading..." : "Save Profile"}</Text>
          </Pressable>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  page: { padding: 16, gap: 14, paddingBottom: 28, maxWidth: 520, alignSelf: "center", width: "100%" },
  header: { gap: 4 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 13 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(220, 38, 38, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickStatsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  quickStat: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 4,
  },
  quickLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "900" },
  quickValue: { color: "#fff", fontSize: 14, fontWeight: "900" },
  fieldGroup: { gap: 6 },
  label: { color: "#D1D5DB", fontSize: 12, fontWeight: "700" },
  readonly: {
    color: "#E5E7EB",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  input: {
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.35)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  disabled: { opacity: 0.6 },
  hint: { color: "#9CA3AF", fontSize: 12 },
});
