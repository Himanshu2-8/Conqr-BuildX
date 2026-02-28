import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

type Ring = {
  id: string;
  label: string;
  valueLabel: string;
  progress: number; // 0..1
  color: string;
};

type ActivityRingsProps = {
  rings: Ring[];
  size?: number;
  stroke?: number;
  gap?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function useAnimatedProgress(target: number, durationMs = 650) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamp01(target),
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [anim, target, durationMs]);
  return anim;
}

export function ActivityRings({
  rings,
  size = 140,
  stroke = 14,
  gap = 7,
  selectedId,
  onSelect,
}: ActivityRingsProps) {
  const center = size / 2;

  const normalized = useMemo(
    () =>
      rings.map((r) => ({
        ...r,
        progress: clamp01(r.progress),
      })),
    [rings]
  );

  // Outer -> inner
  const radii = useMemo(() => {
    const out: number[] = [];
    let current = center - stroke / 2;
    for (let i = 0; i < normalized.length; i++) {
      out.push(current);
      current -= stroke + gap;
    }
    return out;
  }, [center, stroke, gap, normalized.length]);

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={center} originY={center}>
          {normalized.map((ring, idx) => {
            const r = radii[idx] ?? 0;
            const circumference = 2 * Math.PI * r;
            const animated = useAnimatedProgress(ring.progress);

            const isSelected = selectedId ? ring.id === selectedId : false;
            const trackColor = "rgba(255,255,255,0.08)";
            const alpha = isSelected || !selectedId ? 1 : 0.45;

            return (
              <React.Fragment key={ring.id}>
                <Circle
                  cx={center}
                  cy={center}
                  r={r}
                  stroke={trackColor}
                  strokeWidth={stroke}
                  fill="transparent"
                />
                <AnimatedCircle
                  cx={center}
                  cy={center}
                  r={r}
                  stroke={ring.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={Animated.multiply(animated, -circumference).interpolate({
                    inputRange: [-circumference, 0],
                    outputRange: [0, circumference],
                  })}
                  opacity={alpha}
                />
              </React.Fragment>
            );
          })}
        </G>
      </Svg>

      <View style={styles.legend}>
        {normalized.map((ring) => {
          const active = selectedId ? ring.id === selectedId : false;
          return (
            <Pressable
              key={ring.id}
              android_ripple={{ color: "rgba(255,255,255,0.10)" }}
              hitSlop={10}
              onPress={() => onSelect?.(ring.id)}
              style={({ pressed }) => [
                styles.legendRow,
                pressed && styles.pressed,
                active && styles.legendRowActive,
              ]}
            >
              <View style={[styles.dot, { backgroundColor: ring.color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {ring.label}
                </Text>
                <Text style={styles.legendValue} numberOfLines={1}>
                  {ring.valueLabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 14, alignItems: "center" },
  legend: { flex: 1, gap: 8 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  legendRowActive: {
    borderColor: "rgba(220,38,38,0.55)",
    backgroundColor: "rgba(220,38,38,0.10)",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: "#E5E7EB", fontSize: 13, fontWeight: "900" },
  legendValue: { color: "#9CA3AF", fontSize: 12, fontWeight: "700", marginTop: 2 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
});

