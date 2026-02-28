# Deterministic Run Validation (No ML)

This module adds explainable rules-only speed/cheating detection for run telemetry.
It supports two activity sections:
- `walking` (includes running)
- `cycling`

## Run locally

```bash
pip install fastapi uvicorn pytest
uvicorn backend.validation.api:app --host 0.0.0.0 --port 8000 --reload
```

Set client API base URL:

```bash
EXPO_PUBLIC_VALIDATION_API_URL=http://127.0.0.1:8000
```

For physical device testing, use your LAN IP instead of `127.0.0.1`.

## Endpoint

`POST /validate_run`

### Example request

```json
{
  "run_id": "demo-run-1",
  "user_id": "demo-user-1",
  "activity_type": "walking",
  "points": [
    { "lat": 12.9716, "lon": 77.5946, "ts_ms": 1710000000000, "gps_accuracy": 8.5 },
    { "lat": 12.97162, "lon": 77.59472, "ts_ms": 1710000005000, "gps_accuracy": 9.1 },
    { "lat": 12.97164, "lon": 77.59485, "ts_ms": 1710000010000, "gps_accuracy": 8.9 }
  ]
}
```

### Example response

```json
{
  "run_id": "demo-run-1",
  "status": "valid",
  "confidence": 0.92,
  "reasons": ["likely_walk"],
  "features": {
    "mean_speed_mps": 2.1,
    "std_speed_mps": 0.2,
    "max_speed_mps": 2.3,
    "total_distance_m": 21.0,
    "duration_s": 10.0,
    "avg_speed_mps": 2.1,
    "accel_mean": null,
    "accel_std": null
  },
  "flagged_segments": [],
  "updated_at": "2026-02-28T10:00:00.000000+00:00"
}
```

## Curl / Postman check

```bash
curl -X POST "http://127.0.0.1:8000/validate_run" \
  -H "Content-Type: application/json" \
  -d '{"run_id":"demo-run-teleport","user_id":"u1","activity_type":"walking","points":[{"lat":0,"lon":0,"ts_ms":0},{"lat":0,"lon":0.003,"ts_ms":3000}]}'
```

## Demo tips

- Valid walking run: 1-2 m/s average with good GPS accuracy.
- Cheating run: add a 250m+ jump within 5 seconds to trigger `teleport_jump`.
- Ambiguous run: keep average speed between 8 and 25 km/h for walking to get `flagged` and trigger backend re-check.
- Valid cycling run: keep average speed in a realistic cycling range and use `activity_type: cycling`.
