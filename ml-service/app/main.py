"""
FastAPI ML sidecar for RiftSense.

Endpoints:
  GET  /health   -> liveness + model_version + loaded flag
  POST /predict  -> classify a feature vector emitted by the Node backend

The response shape on /predict is intentionally identical to what the Node
mlClient already expects, so callMLService can deserialize without remapping.
"""

from __future__ import annotations

from typing import Any, Optional

import logging

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.model import model

logger = logging.getLogger("riftsense.ml")


class Features(BaseModel):
    magnitude: float = 0.0
    avg_magnitude: float = 0.0
    std_magnitude: float = 0.0
    peak_acceleration: float = 0.0
    duration_ms: float = 0.0
    sample_count: float = 0.0
    sta_lta_ratio: float = 0.0

    class Config:
        extra = "allow"


class PredictRequest(BaseModel):
    features: Optional[Features] = None
    # Allow callers to send features at the top level as well.
    magnitude: Optional[float] = None
    avg_magnitude: Optional[float] = None
    std_magnitude: Optional[float] = None
    peak_acceleration: Optional[float] = None
    duration_ms: Optional[float] = None
    sample_count: Optional[float] = None
    sta_lta_ratio: Optional[float] = None

    def resolved(self) -> dict[str, Any]:
        if self.features is not None:
            return self.features.dict()
        return {
            "magnitude": self.magnitude or 0.0,
            "avg_magnitude": self.avg_magnitude or 0.0,
            "std_magnitude": self.std_magnitude or 0.0,
            "peak_acceleration": self.peak_acceleration or 0.0,
            "duration_ms": self.duration_ms or 0.0,
            "sample_count": self.sample_count or 0.0,
            "sta_lta_ratio": self.sta_lta_ratio or 0.0,
        }


class PredictResponse(BaseModel):
    prediction: str = Field(..., description="earthquake | noise | unknown")
    confidence: float
    processing_time_ms: int
    model_version: str
    details: dict[str, Any]


app = FastAPI(
    title="RiftSense ML Service",
    version="2.0.0",
    description="Inference sidecar for the RiftSense seismic sensor network.",
)


@app.on_event("startup")
def _warm_model() -> None:
    logging.basicConfig(level=logging.INFO)
    if not model.loaded:
        model.load()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_version": model.version,
        "loaded": model.loaded,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    features = body.resolved()
    result = model.predict(features)
    logger.info(
        "predict label=%s confidence=%s sta_lta=%s magnitude=%s version=%s",
        result.prediction,
        result.confidence,
        features.get("sta_lta_ratio"),
        features.get("magnitude"),
        result.model_version,
    )
    return PredictResponse(
        prediction=result.prediction,
        confidence=result.confidence,
        processing_time_ms=result.processing_time_ms,
        model_version=result.model_version,
        details=result.details,
    )
