import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "./context/AuthContext";
import { addFriendByUsername, subscribeFriends, type FriendRow } from "./services/friends";

export function FriendsScreen() {
  const { user } = useAuth();
  const [usernameInput, setUsernameInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      return;
    }
    setError(null);
    const unsubscribe = subscribeFriends(
      user.uid,
      (rows) => setFriends(rows),
      (err) => setError(err.message || "Failed to load friends")
    );
    return unsubscribe;
  }, [user]);

  const onAddFriend = async () => {
    if (!user) {
      Alert.alert("Friends", "Please sign in again.");
      return;
    }
    const clean = usernameInput.trim();
    if (!clean) {
      Alert.alert("Friends", "Enter a username.");
      return;
    }
    setAdding(true);
    try {
      await addFriendByUsername(user.uid, clean);
      setUsernameInput("");
      Alert.alert("Friend Added", `${clean} has been added.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not add friend";
      Alert.alert("Add friend failed", message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Share usernames and add friends instantly.</Text>
        </View>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.sectionTitle}>Add Friend</Text>
          <TextInput
            value={usernameInput}
            onChangeText={setUsernameInput}
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed, adding && styles.disabled]}
            onPress={onAddFriend}
            disabled={adding}
          >
            <Text style={styles.addButtonText}>{adding ? "Adding..." : "Add by Username"}</Text>
          </Pressable>
        </LinearGradient>

        <LinearGradient colors={["#1a0205", "#050505"]} style={styles.card}>
          <Text style={styles.sectionTitle}>Your Friends</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {friends.length === 0 ? <Text style={styles.hint}>No friends yet. Add your first friend above.</Text> : null}
          <View style={styles.list}>
            {friends.map((friend) => (
              <View key={friend.uid} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{friend.username.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.username}>{friend.username}</Text>
                  <Text style={styles.meta}>
                    {friend.email || friend.uid.slice(0, 10)}
                    {friend.addedAt ? ` • Added ${friend.addedAt.toLocaleDateString()}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
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
    gap: 10,
  },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
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
  addButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  disabled: { opacity: 0.6 },
  hint: { color: "#9CA3AF", fontSize: 12 },
  error: { color: "#FB7185", fontSize: 12 },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  username: { color: "#fff", fontSize: 14, fontWeight: "800" },
  meta: { color: "#9CA3AF", fontSize: 11 },
});
