from __future__ import annotations

from backend.validation.validator import deterministic_validate, detect_teleport


def test_detect_teleport_short_dt_long_jump() -> None:
    points = [
        {"lat": 0.0, "lon": 0.0, "ts_ms": 0},
        {"lat": 0.0, "lon": 0.003, "ts_ms": 3000},
    ]

    flagged = detect_teleport(points)

    assert len(flagged) == 1
    assert flagged[0]["kind"] == "teleport_jump"


def test_impossible_speed_marks_cheating() -> None:
    points = [
        {"lat": 0.0, "lon": 0.0, "ts_ms": 0},
        {"lat": 0.0, "lon": 0.0054, "ts_ms": 10000},
    ]

    result = deterministic_validate(points)

    assert result["status"] == "cheating"
    assert "impossible_speed" in result["reasons"]


def test_clear_walk_marks_valid() -> None:
    points = [
        {"lat": 0.0, "lon": 0.0, "ts_ms": 0, "gps_accuracy": 5.0},
        {"lat": 0.0, "lon": 0.00018, "ts_ms": 20000, "gps_accuracy": 6.0},
        {"lat": 0.0, "lon": 0.00036, "ts_ms": 40000, "gps_accuracy": 6.0},
        {"lat": 0.0, "lon": 0.00054, "ts_ms": 60000, "gps_accuracy": 7.0},
    ]

    result = deterministic_validate(points, activity_type="walking")

    assert result["status"] == "valid"
    assert "likely_walk" in result["reasons"]


def test_clear_vehicle_marks_flagged() -> None:
    points = [
        {"lat": 0.0, "lon": 0.0, "ts_ms": 0},
        {"lat": 0.0, "lon": 0.0009, "ts_ms": 10000},
        {"lat": 0.0, "lon": 0.0018, "ts_ms": 20000},
        {"lat": 0.0, "lon": 0.0027, "ts_ms": 30000},
    ]

    result = deterministic_validate(points)

    assert result["status"] == "flagged"
    assert "likely_vehicle" in result["reasons"]


def test_clear_cycling_marks_valid() -> None:
    points = [
        {"lat": 0.0, "lon": 0.0, "ts_ms": 0},
        {"lat": 0.0, "lon": 0.0006, "ts_ms": 15000},
        {"lat": 0.0, "lon": 0.0012, "ts_ms": 30000},
        {"lat": 0.0, "lon": 0.0018, "ts_ms": 45000},
    ]

    result = deterministic_validate(points, activity_type="cycling")

    assert result["status"] == "valid"
    assert "likely_cycle" in result["reasons"]


def test_too_few_points_marks_flagged() -> None:
    result = deterministic_validate([{"lat": 0.0, "lon": 0.0, "ts_ms": 0}])

    assert result["status"] == "flagged"
    assert "too_few_points" in result["reasons"]
