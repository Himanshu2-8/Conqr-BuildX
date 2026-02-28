"""FastAPI endpoint for deterministic run validation.

Local run example:
    uvicorn backend.validation.api:app --host 0.0.0.0 --port 8000 --reload

For Expo local development set:
    EXPO_PUBLIC_VALIDATION_API_URL=http://<LAN_IP>:8000
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .validator import deterministic_validate


class TelemetryPoint(BaseModel):
    lat: float
    lon: float
    ts_ms: int
    accel_magnitude: Optional[float] = None
    gps_accuracy: Optional[float] = None


class ValidateRunRequest(BaseModel):
    run_id: Optional[str] = None
    user_id: Optional[str] = None
    points: List[TelemetryPoint] = Field(default_factory=list)


app = FastAPI(title="CONQR Deterministic Validation API", version="1.0.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/validate_run")
def validate_run(payload: ValidateRunRequest) -> Dict[str, Any]:
    if len(payload.points) < 2:
        raise HTTPException(status_code=400, detail="At least 2 telemetry points are required.")

    result = deterministic_validate([point.model_dump() for point in payload.points])
    return {
        "run_id": payload.run_id,
        "status": result["status"],
        "confidence": result["confidence"],
        "reasons": result["reasons"],
        "features": result["features"],
        "flagged_segments": result["flagged_segments"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
