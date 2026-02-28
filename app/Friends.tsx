import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, onSnapshot } from "firebase/firestore";

import { useAuth } from "./context/AuthContext";
import { db } from "./lib/firebase";
import { LiveBadge } from "./ui/LiveBadge";
import {
  buildFriendChallengeShareMessage,
  createFriendChallenge,
  formatChallengeTimeRemaining,
  joinFriendChallengeByCode,
  startFriendChallenge,
  subscribeFriendChallengesForUser,
  type FriendChallenge,
} from "./services/friendChallenges";

type ChallengeRow = {
  userId: string;
  username: string;
  gainedDistanceM: number;
  currentDistanceM: number;
};

const DURATION_OPTIONS = [15, 30, 60, 90];

function GradientCard({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={["#1a0205", "#050505"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {children}
    </LinearGradient>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDistance(valueM: number) {
  if (valueM >= 1000) {
    return `${(valueM / 1000).toFixed(2)} km`;
  }
  return `${Math.round(valueM)} m`;
}

function buildStandings(challenge: FriendChallenge, distanceByUserId: Record<string, number>): ChallengeRow[] {
  return challenge.participants
    .map((participant) => {
      const currentDistanceM = distanceByUserId[participant.userId] ?? participant.baselineDistanceM;
      return {
        userId: participant.userId,
        username: participant.username,
        currentDistanceM,
        gainedDistanceM: Math.max(currentDistanceM - participant.baselineDistanceM, 0),
      };
    })
    .sort((a, b) => {
      if (b.gainedDistanceM !== a.gainedDistanceM) {
        return b.gainedDistanceM - a.gainedDistanceM;
      }
      return b.currentDistanceM - a.currentDistanceM;
    });
}

export function FriendsScreen() {
  const { user } = useAuth();
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<FriendChallenge[]>([]);
  const [distanceByUserId, setDistanceByUserId] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setChallenges([]);
      setLoadingChallenges(false);
      return;
    }

    setLoadingChallenges(true);
    setChallengeError(null);
    const unsubscribe = subscribeFriendChallengesForUser(
      user.uid,
      (rows) => {
        setChallenges(rows);
        setLoadingChallenges(false);
      },
      (error) => {
        setChallengeError(error.message || "Failed to load friend challenges");
        setLoadingChallenges(false);
      }
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const next: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        next[docSnap.id] = typeof data?.totalDistance === "number" ? data.totalDistance : 0;
      });
      setDistanceByUserId(next);
    });

    return unsubscribe;
  }, []);

  const myDistanceM = user ? distanceByUserId[user.uid] ?? 0 : 0;
  const displayName = user?.displayName?.trim() || user?.email?.split("@")[0] || "Runner";

  const onCreateChallenge = async () => {
    if (!user) {
      Alert.alert("Friends", "Please sign in again.");
      return;
    }

    setCreating(true);
    try {
      const challenge = await createFriendChallenge({
        hostUserId: user.uid,
        hostUsername: displayName,
        durationMinutes,
        baselineDistanceM: myDistanceM,
      });
      await Share.share({ message: buildFriendChallengeShareMessage(challenge) });
      Alert.alert("Challenge ready", `Code ${challenge.inviteCode} created and ready to share.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create challenge";
      Alert.alert("Create failed", message);
    } finally {
      setCreating(false);
    }
  };

  const onJoinChallenge = async () => {
    if (!user) {
      Alert.alert("Friends", "Please sign in again.");
      return;
    }

    setJoining(true);
    try {
      await joinFriendChallengeByCode({
        inviteCode: inviteCodeInput,
        userId: user.uid,
        username: displayName,
        baselineDistanceM: myDistanceM,
      });
      setInviteCodeInput("");
      Alert.alert("Joined", "You joined the friend challenge.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to join challenge";
      Alert.alert("Join failed", message);
    } finally {
      setJoining(false);
    }
  };

  const onShareChallenge = async (challenge: FriendChallenge) => {
    try {
      await Share.share({ message: buildFriendChallengeShareMessage(challenge) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Share failed";
      Alert.alert("Share failed", message);
    }
  };

  const onStartChallenge = async (challenge: FriendChallenge) => {
    if (!user) {
      return;
    }
    try {
      await startFriendChallenge(challenge.id, user.uid, distanceByUserId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start challenge";
      Alert.alert("Start failed", message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>
            Create a room, invite up to 4 friends, then the host starts the timer. Distance gained during the match decides the winner.
          </Text>
        </View>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Create Challenge</Text>
          </View>

          <Text style={styles.hint}>Your current total distance ({formatDistance(myDistanceM)}) becomes the start baseline.</Text>

          <View style={styles.optionRow}>
            {DURATION_OPTIONS.map((option) => {
              const active = option === durationMinutes;
              return (
                <Pressable
                  key={option}
                  style={({ pressed }) => [styles.optionBtn, active && styles.optionBtnActive, pressed && styles.pressed]}
                  onPress={() => setDurationMinutes(option)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}m</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, creating && styles.disabled]}
            onPress={onCreateChallenge}
            disabled={creating}
          >
            <Text style={styles.primaryButtonText}>{creating ? "Creating..." : "Create Room & Share Invite"}</Text>
          </Pressable>
          <Text style={styles.hint}>Friends join first. The host starts the game when everyone is ready.</Text>
        </GradientCard>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="link-variant" size={18} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Join By Code</Text>
          </View>

          <TextInput
            value={inviteCodeInput}
            onChangeText={(value) => setInviteCodeInput(value.toUpperCase())}
            placeholder="Enter challenge code"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, joining && styles.disabled]}
            onPress={onJoinChallenge}
            disabled={joining}
          >
            <Text style={styles.secondaryButtonText}>{joining ? "Joining..." : "Join Challenge"}</Text>
          </Pressable>
        </GradientCard>

        <GradientCard>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="sword-cross" size={18} color="#DC2626" />
            </View>
            <Text style={styles.cardTitle}>Active Rooms</Text>
            {!loadingChallenges && challenges.some((challenge) => challenge.status === "active" && now < challenge.endsAtMs) ? <LiveBadge /> : null}
          </View>

          {loadingChallenges ? <Text style={styles.hint}>Loading friend rooms...</Text> : null}
          {challengeError ? <Text style={styles.error}>{challengeError}</Text> : null}
          {!loadingChallenges && !challengeError && challenges.length === 0 ? (
            <Text style={styles.hint}>No rooms yet. Create one and share the code with friends.</Text>
          ) : null}

          <View style={styles.challengeList}>
            {challenges.map((challenge) => {
              const finished = challenge.status === "completed" || (challenge.endsAtMs > 0 && now >= challenge.endsAtMs);
              const standings = buildStandings(challenge, distanceByUserId);
              const winner = standings[0];
              const isHost = challenge.hostUserId === user?.uid;

              return (
                <View key={challenge.id} style={styles.challengeCard}>
                  <View style={styles.challengeTop}>
                    <View style={styles.challengeMeta}>
                      <Text style={styles.challengeCode}>Code {challenge.inviteCode}</Text>
                      <Text style={styles.challengeHint}>
                        {finished ? "Finished" : formatChallengeTimeRemaining(challenge)} • {challenge.participants.length - 1}/4 friends
                      </Text>
                    </View>
                    {isHost && challenge.status === "waiting" ? (
                      <Pressable style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]} onPress={() => onStartChallenge(challenge)}>
                        <Text style={styles.startBtnText}>Start</Text>
                      </Pressable>
                    ) : null}
                    {isHost ? (
                      <Pressable style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]} onPress={() => onShareChallenge(challenge)}>
                        <MaterialCommunityIcons name="share-variant" size={15} color="#FCA5A5" />
                      </Pressable>
                    ) : null}
                  </View>

                  {finished && winner ? (
                    <View style={styles.winnerBanner}>
                      <MaterialCommunityIcons name="trophy" size={16} color="#FACC15" />
                      <Text style={styles.winnerText}>
                        {winner.username} wins with {formatDistance(winner.gainedDistanceM)} gained
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.standingsList}>
                    {standings.map((row, index) => (
                      <View key={`${challenge.id}-${row.userId}`} style={[styles.row, index === 0 && styles.rowTop]}>
                        <View style={[styles.avatar, index === 0 && styles.avatarTop]}>
                          <Text style={styles.avatarText}>{getInitials(row.username)}</Text>
                        </View>
                        <View style={styles.rowMain}>
                          <Text style={styles.username} numberOfLines={1}>
                            {row.username}
                          </Text>
                          <Text style={styles.userHint}>
                            Total {formatDistance(row.currentDistanceM)}
                          </Text>
                        </View>
                        <View style={styles.valueWrap}>
                          <Text style={[styles.value, index === 0 && styles.valueTop]}>
                            +{formatDistance(row.gainedDistanceM)}
                          </Text>
                          <Text style={styles.valueUnit}>distance</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </GradientCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  page: { padding: 16, gap: 14, paddingBottom: 28, maxWidth: 520, alignSelf: "center", width: "100%" },
  header: { gap: 4 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(127, 29, 29, 0.30)",
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(220, 38, 38, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  hint: { color: "#9CA3AF", fontSize: 12 },
  error: { color: "#FB7185", fontSize: 12 },
  optionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  optionBtn: {
    minWidth: 64,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  optionBtnActive: {
    backgroundColor: "rgba(220, 38, 38, 0.20)",
    borderColor: "rgba(220, 38, 38, 0.55)",
  },
  optionText: { color: "#E5E7EB", fontWeight: "800" },
  optionTextActive: { color: "#FCA5A5" },
  input: {
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.35)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(69, 10, 10, 0.22)",
  },
  secondaryButtonText: { color: "#FCA5A5", fontSize: 15, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  disabled: { opacity: 0.6 },
  challengeList: { gap: 12 },
  challengeCard: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  challengeTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  challengeMeta: { flex: 1, gap: 2 },
  challengeCode: { color: "#fff", fontSize: 15, fontWeight: "900" },
  challengeHint: { color: "#9CA3AF", fontSize: 12 },
  startBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(220,38,38,0.16)",
  },
  startBtnText: { color: "#FCA5A5", fontSize: 12, fontWeight: "900" },
  shareBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.35)",
    backgroundColor: "rgba(220,38,38,0.10)",
  },
  winnerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.30)",
  },
  winnerText: { color: "#FDE68A", fontSize: 12, fontWeight: "800", flex: 1 },
  standingsList: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  rowTop: {
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.45)",
    backgroundColor: "rgba(220,38,38,0.10)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTop: { backgroundColor: "#DC2626" },
  avatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  username: { color: "#fff", fontSize: 13, fontWeight: "800" },
  userHint: { color: "#9CA3AF", fontSize: 11 },
  valueWrap: { alignItems: "flex-end" },
  value: { color: "#E5E7EB", fontSize: 13, fontWeight: "900" },
  valueTop: { color: "#FCA5A5" },
  valueUnit: { color: "#9CA3AF", fontSize: 11 },
});
