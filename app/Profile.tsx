import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "./context/AuthContext";
import { fetchUserProfile, updateUserProfile } from "./services/profile";

export function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [collegeName, setCollegeName] = useState("");

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const profile = await fetchUserProfile(user.uid, user.email ?? "");
      setUsername(profile.username || user.displayName || "");
      setCity(profile.city);
      setCollegeName(profile.collegeName);
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
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
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
});
