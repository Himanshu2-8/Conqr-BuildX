import type { ActivityType } from "../types/activity";

export type ValidationStatus = "valid" | "flagged" | "cheating";

export type ValidationReason =
  | "too_few_points"
  | "teleport_jump"
  | "impossible_speed"
  | "likely_walk"
  | "likely_cycle"
  | "likely_vehicle"
  | "ambiguous_speed"
  | "low_gps_accuracy";

export type TelemetryPoint = {
  lat: number;
  lon: number;
  ts_ms: number;
  accel_magnitude?: number;
  gps_accuracy?: number;
};

export type ValidationFeatures = {
  mean_speed_mps: number;
  std_speed_mps: number;
  max_speed_mps: number;
  total_distance_m: number;
  duration_s: number;
  avg_speed_mps: number;
  accel_mean: number | null;
  accel_std: number | null;
};

export type FlaggedSegment = {
  index_from: number;
  index_to: number;
  distance_m: number;
  dt_s: number;
  speed_mps: number | null;
  kind: "teleport_jump" | "impossible_speed";
};

export type ValidationResult = {
  status: ValidationStatus;
  confidence: number;
  reasons: ValidationReason[];
  features: ValidationFeatures;
  flagged_segments: FlaggedSegment[];
  updated_at: string;
};

export const MIN_POINTS = 2;
export const TELEPORT_JUMP_THRESHOLD_M = 200;
export const TELEPORT_DT_THRESHOLD_S = 5;
export const IMPOSSIBLE_SPEED_THRESHOLD_MPS = 45;
export const WALK_AVG_SPEED_KMPH_MAX = 8;
export const WALK_VEHICLE_SPEED_KMPH_MIN = 25;
export const CYCLE_MIN_EXPECTED_KMPH = 4;
export const CYCLE_MAX_EXPECTED_KMPH = 35;
export const CYCLE_VEHICLE_SPEED_KMPH_MIN = 40;
export const VEHICLE_DISTANCE_MIN_M = 200;
export const LOW_GPS_ACCURACY_MEDIAN_M = 30;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a: TelemetryPoint, b: TelemetryPoint) {
  const R = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function computeSpeeds(points: TelemetryPoint[]) {
  const speeds: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dtSeconds = (b.ts_ms - a.ts_ms) / 1000;
    if (dtSeconds <= 0) {
      continue;
    }
    const distanceMeters = haversineMeters(a, b);
    speeds.push(distanceMeters / dtSeconds);
  }
  return speeds;
}

export function windowFeatures(points: TelemetryPoint[]): ValidationFeatures {
  if (points.length < 2) {
    return {
      mean_speed_mps: 0,
      std_speed_mps: 0,
      max_speed_mps: 0,
      total_distance_m: 0,
      duration_s: 0,
      avg_speed_mps: 0,
      accel_mean: null,
      accel_std: null,
    };
  }

  const speeds = computeSpeeds(points);
  let totalDistanceMeters = 0;
  for (let i = 1; i < points.length; i += 1) {
    totalDistanceMeters += haversineMeters(points[i - 1], points[i]);
  }

  const durationSeconds = Math.max((points[points.length - 1].ts_ms - points[0].ts_ms) / 1000, 0);
  const accel = points
    .map((point) => point.accel_magnitude)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    mean_speed_mps: mean(speeds),
    std_speed_mps: std(speeds),
    max_speed_mps: speeds.length > 0 ? Math.max(...speeds) : 0,
    total_distance_m: totalDistanceMeters,
    duration_s: durationSeconds,
    avg_speed_mps: durationSeconds > 0 ? totalDistanceMeters / durationSeconds : 0,
    accel_mean: accel.length > 0 ? mean(accel) : null,
    accel_std: accel.length > 0 ? std(accel) : null,
  };
}

export function detectTeleport(
  points: TelemetryPoint[],
  jumpThresholdM = TELEPORT_JUMP_THRESHOLD_M,
  dtThresholdS = TELEPORT_DT_THRESHOLD_S
) {
  const flagged: FlaggedSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dtSeconds = (b.ts_ms - a.ts_ms) / 1000;
    if (dtSeconds <= 0 || dtSeconds > dtThresholdS) {
      continue;
    }
    const distanceMeters = haversineMeters(a, b);
    if (distanceMeters > jumpThresholdM) {
      flagged.push({
        index_from: i - 1,
        index_to: i,
        distance_m: distanceMeters,
        dt_s: dtSeconds,
        speed_mps: distanceMeters / dtSeconds,
        kind: "teleport_jump",
      });
    }
  }
  return flagged;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function classifySpeed(activityType: ActivityType, avgSpeedKmph: number): ValidationReason {
  if (activityType === "cycling") {
    if (avgSpeedKmph > CYCLE_VEHICLE_SPEED_KMPH_MIN) {
      return "likely_vehicle";
    }
    if (avgSpeedKmph >= CYCLE_MIN_EXPECTED_KMPH && avgSpeedKmph <= CYCLE_MAX_EXPECTED_KMPH) {
      return "likely_cycle";
    }
    if (avgSpeedKmph < CYCLE_MIN_EXPECTED_KMPH) {
      return "ambiguous_speed";
    }
    return "ambiguous_speed";
  }

  if (avgSpeedKmph < WALK_AVG_SPEED_KMPH_MAX) {
    return "likely_walk";
  }
  if (avgSpeedKmph > WALK_VEHICLE_SPEED_KMPH_MIN) {
    return "likely_vehicle";
  }
  return "ambiguous_speed";
}

export function localValidate(points: TelemetryPoint[], activityType: ActivityType = "walking"): ValidationResult {
  const nowIso = new Date().toISOString();
  if (points.length < MIN_POINTS) {
    return {
      status: "flagged",
      confidence: 0.2,
      reasons: ["too_few_points"],
      features: windowFeatures(points),
      flagged_segments: [],
      updated_at: nowIso,
    };
  }

  const features = windowFeatures(points);
  const reasons: ValidationReason[] = [];
  const flaggedSegments: FlaggedSegment[] = detectTeleport(points);
  const speeds = computeSpeeds(points);

  const hasTeleport = flaggedSegments.some((segment) => segment.kind === "teleport_jump");
  let hasImpossibleSpeed = false;

  for (let i = 0; i < speeds.length; i += 1) {
    const speed = speeds[i];
    if (speed > IMPOSSIBLE_SPEED_THRESHOLD_MPS) {
      hasImpossibleSpeed = true;
      const fromPoint = points[i];
      const toPoint = points[i + 1];
      const dtSeconds = Math.max((toPoint.ts_ms - fromPoint.ts_ms) / 1000, 0);
      flaggedSegments.push({
        index_from: i,
        index_to: i + 1,
        distance_m: haversineMeters(fromPoint, toPoint),
        dt_s: dtSeconds,
        speed_mps: speed,
        kind: "impossible_speed",
      });
    }
  }

  if (hasTeleport) {
    reasons.push("teleport_jump");
  }
  if (hasImpossibleSpeed) {
    reasons.push("impossible_speed");
  }

  const avgSpeedKmph = features.avg_speed_mps * 3.6;
  const speedBucket = classifySpeed(activityType, avgSpeedKmph);
  reasons.push(speedBucket);

  const gpsAccuracies = points
    .map((point) => point.gps_accuracy)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const medianAccuracy = median(gpsAccuracies);
  const hasLowAccuracy = medianAccuracy !== null && medianAccuracy > LOW_GPS_ACCURACY_MEDIAN_M;
  if (hasLowAccuracy) {
    reasons.push("low_gps_accuracy");
  }

  let status: ValidationStatus = "valid";
  let confidence = activityType === "cycling" ? 0.9 : 0.92;

  if (hasTeleport || hasImpossibleSpeed) {
    status = "cheating";
    confidence = 0.98;
  } else if (speedBucket === "likely_vehicle" && features.total_distance_m > VEHICLE_DISTANCE_MIN_M) {
    status = "flagged";
    confidence = 0.55;
  } else if (speedBucket === "ambiguous_speed") {
    status = "flagged";
    confidence = 0.5;
  }

  if (hasLowAccuracy) {
    confidence -= 0.15;
  }

  return {
    status,
    confidence: clamp01(confidence),
    reasons,
    features,
    flagged_segments: flaggedSegments,
    updated_at: nowIso,
  };
}

type ResolveValidationInput = {
  runId?: string;
  userId?: string;
  points: TelemetryPoint[];
  activityType?: ActivityType;
};

/**
 * EXPO_PUBLIC_VALIDATION_API_URL should be set to a base URL like:
 * http://127.0.0.1:8000
 */
export async function resolveValidation(input: ResolveValidationInput): Promise<ValidationResult> {
  const activityType = input.activityType ?? "walking";
  const localResult = localValidate(input.points, activityType);
  if (localResult.status === "valid" || localResult.status === "cheating") {
    return localResult;
  }

  const baseUrl = process.env.EXPO_PUBLIC_VALIDATION_API_URL;
  if (!baseUrl) {
    return localResult;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/validate_run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        run_id: input.runId,
        user_id: input.userId,
        points: input.points,
        activity_type: activityType,
      }),
    });

    if (!response.ok) {
      return localResult;
    }
    const data = (await response.json()) as Partial<ValidationResult>;
    if (data.status !== "valid" && data.status !== "flagged" && data.status !== "cheating") {
      return localResult;
    }

    return {
      status: data.status,
      confidence: typeof data.confidence === "number" ? clamp01(data.confidence) : localResult.confidence,
      reasons: Array.isArray(data.reasons) ? (data.reasons as ValidationReason[]) : localResult.reasons,
      features: (data.features as ValidationFeatures) ?? localResult.features,
      flagged_segments: (data.flagged_segments as FlaggedSegment[]) ?? localResult.flagged_segments,
      updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
    };
  } catch {
    return localResult;
  }
}
