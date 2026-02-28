import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  computeBonusArea,
  computeStakeArea,
  createPrediction,
  getMetricLabel,
  getMetricUnit,
  type Prediction,
  type PredictionMetric,
} from "../services/predictions";
import type { FriendRow } from "../services/friends";
import { fetchFriends } from "../services/friends";

// ── Types ───────────────────────────────────────────────────────────────

type PredictionModalProps = {
  visible: boolean;
  userId: string;
  currentTotalAreaM2: number;
  onCreated: (prediction: Prediction) => void;
  onClose: () => void;
};

// ── Metric cards ────────────────────────────────────────────────────────

const METRICS: { key: PredictionMetric; icon: string; desc: string }[] = [
  { key: "distance", icon: "map-marker-distance", desc: "Predict how far you'll run" },
  { key: "pace", icon: "speedometer", desc: "Predict your avg pace" },
  { key: "area", icon: "texture-box", desc: "Predict territory gained" },
];

// ── Component ───────────────────────────────────────────────────────────

export function PredictionModal({
  visible,
  userId,
  currentTotalAreaM2,
  onCreated,
  onClose,
}: PredictionModalProps) {
  const [step, setStep] = useState<"metric" | "value" | "challenge" | "confirm">("metric");
  const [metric, setMetric] = useState<PredictionMetric>("distance");
  const [inputValue, setInputValue] = useState("");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendRow | null>(null);
  const [creating, setCreating] = useState(false);

  const stakeArea = computeStakeArea(currentTotalAreaM2);
  const bonusArea = computeBonusArea(stakeArea);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setStep("metric");
      setMetric("distance");
      setInputValue("");
      setSelectedFriend(null);
      setCreating(false);
    }
  }, [visible]);

  // Fetch friends once when we enter challenge step
  useEffect(() => {
    if (step === "challenge" && friends.length === 0) {
      fetchFriends(userId)
        .then(setFriends)
        .catch(() => setFriends([]));
    }
  }, [step, userId, friends.length]);

  const parsedValue = useCallback((): number | null => {
    const raw = inputValue.trim();
    if (!raw) return null;
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) return null;
    // Convert user-friendly units → internal units
    switch (metric) {
      case "distance":
        return num * 1000; // km → m
      case "pace":
        return num; // already min/km
      case "area":
        return num; // already m²
    }
  }, [inputValue, metric]);

  const handleCreate = async () => {
    const value = parsedValue();
    if (!value) {
      Alert.alert("Invalid value", "Please enter a valid positive number.");
      return;
    }
    setCreating(true);
    try {
      const pred = await createPrediction({
        userId,
        metric,
        predictedValue: value,
        currentTotalAreaM2,
        challengeTargetUserId: selectedFriend?.uid ?? null,
        challengeTargetUsername: selectedFriend?.username ?? null,
      });
      onCreated(pred);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create prediction";
      Alert.alert("Error", msg);
    } finally {
      setCreating(false);
    }
  };

  // ── Render steps ────────────────────────────────────────────────────────

  const renderMetricStep = () => (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Choose Your Bet</Text>
      <Text style={s.stepDesc}>What do you want to predict for this run?</Text>
      <View style={s.metricsGrid}>
        {METRICS.map((m) => {
          const active = metric === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMetric(m.key)}
              style={({ pressed }) => [
                s.metricCard,
                active && s.metricCardActive,
                pressed && s.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name={m.icon as any}
                size={24}
                color={active ? "#DC2626" : "#9CA3AF"}
              />
              <Text style={[s.metricLabel, active && s.metricLabelActive]}>
                {getMetricLabel(m.key)}
              </Text>
              <Text style={s.metricDesc}>{m.desc}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={({ pressed }) => [s.nextBtn, pressed && s.pressed]}
        onPress={() => setStep("value")}
      >
        <Text style={s.nextBtnText}>Next →</Text>
      </Pressable>
    </View>
  );

  const renderValueStep = () => (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Set Your Prediction</Text>
      <Text style={s.stepDesc}>
        Predict your {getMetricLabel(metric).toLowerCase()} within ±15% to win.
      </Text>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="0"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
          value={inputValue}
          onChangeText={setInputValue}
          autoFocus
        />
        <Text style={s.unitText}>{getMetricUnit(metric)}</Text>
      </View>

      <View style={s.stakesCard}>
        <View style={s.stakeRow}>
          <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#FB7185" />
          <Text style={s.stakeLabel}>At stake (miss):</Text>
          <Text style={s.stakeValueBad}>−{stakeArea.toLocaleString()} m²</Text>
        </View>
        <View style={s.stakeRow}>
          <MaterialCommunityIcons name="trophy-outline" size={18} color="#86EFAC" />
          <Text style={s.stakeLabel}>Bonus (hit):</Text>
          <Text style={s.stakeValueGood}>+{bonusArea.toLocaleString()} m²</Text>
        </View>
      </View>

      <View style={s.btnRow}>
        <Pressable style={({ pressed }) => [s.backBtn, pressed && s.pressed]} onPress={() => setStep("metric")}>
          <Text style={s.backBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.nextBtn, pressed && s.pressed]}
          onPress={() => setStep("challenge")}
        >
          <Text style={s.nextBtnText}>Next →</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderChallengeStep = () => (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Challenge a Friend?</Text>
      <Text style={s.stepDesc}>Optional — challenge a friend to match your prediction.</Text>

      <ScrollView style={s.friendsList} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [
            s.friendRow,
            !selectedFriend && s.friendRowActive,
            pressed && s.pressed,
          ]}
          onPress={() => setSelectedFriend(null)}
        >
          <MaterialCommunityIcons name="account-outline" size={20} color="#9CA3AF" />
          <Text style={[s.friendName, !selectedFriend && s.friendNameActive]}>Solo (no challenge)</Text>
        </Pressable>
        {friends.map((friend) => {
          const active = selectedFriend?.uid === friend.uid;
          return (
            <Pressable
              key={friend.uid}
              style={({ pressed }) => [
                s.friendRow,
                active && s.friendRowActive,
                pressed && s.pressed,
              ]}
              onPress={() => setSelectedFriend(friend)}
            >
              <MaterialCommunityIcons
                name="account"
                size={20}
                color={active ? "#DC2626" : "#9CA3AF"}
              />
              <Text style={[s.friendName, active && s.friendNameActive]}>
                {friend.username || friend.email}
              </Text>
            </Pressable>
          );
        })}
        {friends.length === 0 ? (
          <Text style={s.stepDesc}>No friends added yet.</Text>
        ) : null}
      </ScrollView>

      <View style={s.btnRow}>
        <Pressable style={({ pressed }) => [s.backBtn, pressed && s.pressed]} onPress={() => setStep("value")}>
          <Text style={s.backBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.nextBtn, pressed && s.pressed]}
          onPress={() => setStep("confirm")}
        >
          <Text style={s.nextBtnText}>Review →</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderConfirmStep = () => {
    const val = parsedValue();
    return (
      <View style={s.stepWrap}>
        <Text style={s.stepTitle}>Confirm Your Bet</Text>

        <View style={s.confirmCard}>
          <View style={s.confirmRow}>
            <Text style={s.confirmLabel}>Metric</Text>
            <Text style={s.confirmValue}>{getMetricLabel(metric)}</Text>
          </View>
          <View style={s.confirmRow}>
            <Text style={s.confirmLabel}>Prediction</Text>
            <Text style={s.confirmValue}>
              {val ? `${inputValue} ${getMetricUnit(metric)}` : "—"}
            </Text>
          </View>
          <View style={s.confirmRow}>
            <Text style={s.confirmLabel}>Window</Text>
            <Text style={s.confirmValue}>±15%</Text>
          </View>
          <View style={s.confirmRow}>
            <Text style={s.confirmLabel}>If you hit</Text>
            <Text style={[s.confirmValue, { color: "#86EFAC" }]}>+{bonusArea.toLocaleString()} m²</Text>
          </View>
          <View style={s.confirmRow}>
            <Text style={s.confirmLabel}>If you miss</Text>
            <Text style={[s.confirmValue, { color: "#FB7185" }]}>−{stakeArea.toLocaleString()} m²</Text>
          </View>
          {selectedFriend ? (
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Challenge</Text>
              <Text style={s.confirmValue}>{selectedFriend.username || selectedFriend.email}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.btnRow}>
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
            onPress={() => setStep("challenge")}
          >
            <Text style={s.backBtnText}>← Back</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.confirmBtn, pressed && s.pressed, creating && s.disabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#fff" />
            <Text style={s.confirmBtnText}>{creating ? "Locking..." : "Lock It In"}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.modal}>
          <LinearGradient
            colors={["#1a0205", "#050505"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.modalInner}
          >
            <View style={s.header}>
              <View style={s.headerIcon}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#DC2626" />
              </View>
              <Text style={s.headerTitle}>Run Prediction</Text>
              <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [pressed && s.pressed]}>
                <MaterialCommunityIcons name="close" size={22} color="#9CA3AF" />
              </Pressable>
            </View>

            {step === "metric" && renderMetricStep()}
            {step === "value" && renderValueStep()}
            {step === "challenge" && renderChallengeStep()}
            {step === "confirm" && renderConfirmStep()}
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    justifyContent: "flex-end",
  },
  modal: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  modalInner: {
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(127,29,29,0.30)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(220,38,38,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900", flex: 1 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  disabled: { opacity: 0.5 },

  // Steps
  stepWrap: { gap: 14 },
  stepTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  stepDesc: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },

  // Metric cards
  metricsGrid: { gap: 10 },
  metricCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    gap: 4,
  },
  metricCardActive: {
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(220,38,38,0.12)",
  },
  metricLabel: { color: "#E5E7EB", fontSize: 15, fontWeight: "700" },
  metricLabelActive: { color: "#FCA5A5" },
  metricDesc: { color: "#9CA3AF", fontSize: 12 },

  // Value input
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.40)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.30)",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    paddingVertical: 12,
  },
  unitText: { color: "#9CA3AF", fontSize: 16, fontWeight: "700" },

  // Stakes
  stakesCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.30)",
    gap: 10,
  },
  stakeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stakeLabel: { color: "#9CA3AF", fontSize: 13, flex: 1 },
  stakeValueBad: { color: "#FB7185", fontSize: 14, fontWeight: "800" },
  stakeValueGood: { color: "#86EFAC", fontSize: 14, fontWeight: "800" },

  // Friend challenge
  friendsList: { maxHeight: 200 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 6,
  },
  friendRowActive: {
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(220,38,38,0.12)",
  },
  friendName: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  friendNameActive: { color: "#FCA5A5" },

  // Confirm
  confirmCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.30)",
    gap: 10,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmLabel: { color: "#9CA3AF", fontSize: 13 },
  confirmValue: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // Buttons
  btnRow: { flexDirection: "row", gap: 10 },
  nextBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  nextBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  backBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.45)",
    backgroundColor: "rgba(69,10,10,0.22)",
  },
  backBtnText: { color: "#FCA5A5", fontWeight: "700", fontSize: 14 },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.60)",
  },
  confirmBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
