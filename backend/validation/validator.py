"""Rules-only deterministic validator for run telemetry.

No ML dependencies are used. Thresholds are constants for easy tuning.
"""

from __future__ import annotations

import logging
import math
from statistics import median
from typing import Any, Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)

MIN_POINTS = 2
TELEPORT_JUMP_THRESHOLD_M = 200.0
TELEPORT_DT_THRESHOLD_S = 5.0
IMPOSSIBLE_SPEED_THRESHOLD_MPS = 45.0
WALK_AVG_SPEED_KMPH_MAX = 8.0
VEHICLE_AVG_SPEED_KMPH_MIN = 25.0
VEHICLE_DISTANCE_MIN_M = 200.0
LOW_GPS_ACCURACY_MEDIAN_M = 30.0

STATUS_VALID = "valid"
STATUS_FLAGGED = "flagged"
STATUS_CHEATING = "cheating"


def _mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _std(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    avg = _mean(values)
    variance = sum((v - avg) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def haversine_distance_m(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    """Compute distance in meters between two points with lat/lon."""
    radius_m = 6371000.0
    lat1 = math.radians(float(a["lat"]))
    lon1 = math.radians(float(a["lon"]))
    lat2 = math.radians(float(b["lat"]))
    lon2 = math.radians(float(b["lon"]))

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius_m * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def compute_speeds(points: Sequence[Dict[str, Any]]) -> List[float]:
    """Instantaneous segment speeds (m/s) between consecutive points."""
    speeds: List[float] = []
    for i in range(1, len(points)):
        a = points[i - 1]
        b = points[i]
        dt_s = (int(b["ts_ms"]) - int(a["ts_ms"])) / 1000.0
        if dt_s <= 0:
            continue
        distance_m = haversine_distance_m(a, b)
        speeds.append(distance_m / dt_s)
    return speeds


def window_features(points: Sequence[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    """Compute summary features used by deterministic rules."""
    if len(points) < 2:
        return {
            "mean_speed_mps": 0.0,
            "std_speed_mps": 0.0,
            "max_speed_mps": 0.0,
            "total_distance_m": 0.0,
            "duration_s": 0.0,
            "avg_speed_mps": 0.0,
            "accel_mean": None,
            "accel_std": None,
        }

    speeds = compute_speeds(points)
    total_distance_m = sum(haversine_distance_m(points[i - 1], points[i]) for i in range(1, len(points)))
    duration_s = max((int(points[-1]["ts_ms"]) - int(points[0]["ts_ms"])) / 1000.0, 0.0)
    accel_values = [
        float(p["accel_magnitude"])
        for p in points
        if p.get("accel_magnitude") is not None and isinstance(p.get("accel_magnitude"), (int, float))
    ]

    return {
        "mean_speed_mps": _mean(speeds),
        "std_speed_mps": _std(speeds),
        "max_speed_mps": max(speeds) if speeds else 0.0,
        "total_distance_m": total_distance_m,
        "duration_s": duration_s,
        "avg_speed_mps": total_distance_m / duration_s if duration_s > 0 else 0.0,
        "accel_mean": _mean(accel_values) if accel_values else None,
        "accel_std": _std(accel_values) if accel_values else None,
    }


def detect_teleport(
    points: Sequence[Dict[str, Any]],
    jump_threshold_m: float = TELEPORT_JUMP_THRESHOLD_M,
    dt_threshold_s: float = TELEPORT_DT_THRESHOLD_S,
 ) -> List[Dict[str, Any]]:
    """Find suspicious jumps in very short time windows."""
    flagged: List[Dict[str, Any]] = []
    for i in range(1, len(points)):
        a = points[i - 1]
        b = points[i]
        dt_s = (int(b["ts_ms"]) - int(a["ts_ms"])) / 1000.0
        if dt_s <= 0 or dt_s > dt_threshold_s:
            continue
        distance_m = haversine_distance_m(a, b)
        if distance_m > jump_threshold_m:
            flagged.append(
                {
                    "index_from": i - 1,
                    "index_to": i,
                    "distance_m": distance_m,
                    "dt_s": dt_s,
                    "speed_mps": distance_m / dt_s,
                    "kind": "teleport_jump",
                }
            )
    return flagged


def deterministic_validate(points: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Run deterministic, explainable anti-cheat rules."""
    if len(points) < MIN_POINTS:
        return {
            "status": STATUS_FLAGGED,
            "confidence": 0.2,
            "reasons": ["too_few_points"],
            "features": window_features(points),
            "flagged_segments": [],
        }

    features = window_features(points)
    reasons: List[str] = []
    flagged_segments: List[Dict[str, Any]] = detect_teleport(points)
    speeds = compute_speeds(points)

    has_teleport = any(seg.get("kind") == "teleport_jump" for seg in flagged_segments)
    has_impossible_speed = False

    for i, speed in enumerate(speeds):
        if speed > IMPOSSIBLE_SPEED_THRESHOLD_MPS:
            has_impossible_speed = True
            from_p = points[i]
            to_p = points[i + 1]
            dt_s = max((int(to_p["ts_ms"]) - int(from_p["ts_ms"])) / 1000.0, 0.0)
            flagged_segments.append(
                {
                    "index_from": i,
                    "index_to": i + 1,
                    "distance_m": haversine_distance_m(from_p, to_p),
                    "dt_s": dt_s,
                    "speed_mps": speed,
                    "kind": "impossible_speed",
                }
            )

    if has_teleport:
        reasons.append("teleport_jump")
    if has_impossible_speed:
        reasons.append("impossible_speed")

    avg_speed_kmph = float(features["avg_speed_mps"] or 0.0) * 3.6
    speed_bucket = "ambiguous_speed"
    if avg_speed_kmph < WALK_AVG_SPEED_KMPH_MAX:
        speed_bucket = "likely_walk"
    elif avg_speed_kmph > VEHICLE_AVG_SPEED_KMPH_MIN:
        speed_bucket = "likely_vehicle"
    reasons.append(speed_bucket)

    gps_accuracy_values = [
        float(p["gps_accuracy"])
        for p in points
        if p.get("gps_accuracy") is not None and isinstance(p.get("gps_accuracy"), (int, float))
    ]
    med_accuracy = median(gps_accuracy_values) if gps_accuracy_values else None
    low_accuracy = med_accuracy is not None and med_accuracy > LOW_GPS_ACCURACY_MEDIAN_M
    if low_accuracy:
        reasons.append("low_gps_accuracy")

    status = STATUS_VALID
    confidence = 0.92

    if has_teleport or has_impossible_speed:
        status = STATUS_CHEATING
        confidence = 0.98
    elif speed_bucket == "likely_vehicle" and float(features["total_distance_m"] or 0.0) > VEHICLE_DISTANCE_MIN_M:
        status = STATUS_FLAGGED
        confidence = 0.55
    elif speed_bucket == "ambiguous_speed":
        status = STATUS_FLAGGED
        confidence = 0.5

    if low_accuracy:
        confidence -= 0.15

    if flagged_segments:
        logger.warning("validation_flagged_segments status=%s segments=%s", status, flagged_segments)

    return {
        "status": status,
        "confidence": _clamp01(confidence),
        "reasons": reasons,
        "features": features,
        "flagged_segments": flagged_segments,
    }
