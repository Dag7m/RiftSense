"""
RiftSense ML model.

v1 is a small scikit-learn LogisticRegression trained at startup on synthetic
feature vectors that mirror the shape produced by the Node backend's
mlClient.extractFeatures. It returns the same response contract the Node
client already expects so it can be swapped for a real trained model later
without touching the rest of the system.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler


MODEL_VERSION = "v1-logreg-synthetic"

LABELS = ("earthquake", "noise", "unknown")

FEATURE_KEYS = (
    "magnitude",
    "avg_magnitude",
    "std_magnitude",
    "peak_acceleration",
    "duration_ms",
    "sample_count",
    "sta_lta_ratio",
)


def _vectorize(features: dict[str, Any]) -> np.ndarray:
    return np.array(
        [float(features.get(key, 0.0) or 0.0) for key in FEATURE_KEYS],
        dtype=float,
    )


def _generate_synthetic_dataset(n: int = 1500, seed: int = 7):
    """
    Produce three rough clusters so the LR has something defensible to learn:
      - noise: very small magnitudes, sta/lta ~1
      - earthquake: larger magnitudes, sta/lta > ~3
      - unknown: in-between, low sample_count
    """
    rng = np.random.default_rng(seed)
    per_class = n // 3

    def noise():
        mag = rng.uniform(0.001, 0.04, per_class)
        return np.column_stack([
            mag,
            mag * rng.uniform(0.4, 0.9, per_class),
            mag * rng.uniform(0.05, 0.3, per_class),
            mag * rng.uniform(0.9, 1.1, per_class),
            rng.uniform(500, 60_000, per_class),
            rng.uniform(50, 600, per_class),
            rng.uniform(0.5, 1.8, per_class),
        ])

    def earthquake():
        mag = rng.uniform(0.15, 1.5, per_class)
        return np.column_stack([
            mag,
            mag * rng.uniform(0.2, 0.6, per_class),
            mag * rng.uniform(0.2, 0.5, per_class),
            mag * rng.uniform(0.9, 1.1, per_class),
            rng.uniform(3_000, 60_000, per_class),
            rng.uniform(200, 600, per_class),
            rng.uniform(3.0, 8.0, per_class),
        ])

    def unknown():
        mag = rng.uniform(0.03, 0.2, per_class)
        return np.column_stack([
            mag,
            mag * rng.uniform(0.3, 0.8, per_class),
            mag * rng.uniform(0.1, 0.4, per_class),
            mag * rng.uniform(0.9, 1.1, per_class),
            rng.uniform(500, 30_000, per_class),
            rng.uniform(50, 400, per_class),
            rng.uniform(1.5, 3.2, per_class),
        ])

    X = np.vstack([noise(), earthquake(), unknown()])
    y = np.array(
        [0] * per_class + [1] * per_class + [2] * per_class,
        dtype=int,
    )
    # LABELS index: 0=noise, 1=earthquake, 2=unknown.
    return X, y


@dataclass
class PredictionResult:
    prediction: str
    confidence: float
    processing_time_ms: int
    model_version: str
    details: dict[str, Any]


class Model:
    """Wraps a fitted LogisticRegression + StandardScaler."""

    def __init__(self) -> None:
        self._scaler = StandardScaler()
        self._clf = LogisticRegression(
            max_iter=500,
            solver="lbfgs",
        )
        self._loaded = False

    def load(self) -> None:
        X, y = _generate_synthetic_dataset()
        self._scaler.fit(X)
        self._clf.fit(self._scaler.transform(X), y)
        self._loaded = True

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def version(self) -> str:
        return MODEL_VERSION

    def predict(self, features: dict[str, Any]) -> PredictionResult:
        if not self._loaded:
            self.load()

        start = time.perf_counter()
        vec = _vectorize(features).reshape(1, -1)
        scaled = self._scaler.transform(vec)
        proba = self._clf.predict_proba(scaled)[0]
        # Map LR class indices back to label strings (0=noise, 1=earthquake, 2=unknown).
        idx = int(np.argmax(proba))
        label_map = {0: "noise", 1: "earthquake", 2: "unknown"}
        label = label_map[idx]
        confidence = float(round(min(0.99, max(0.01, proba[idx])), 4))

        elapsed_ms = int((time.perf_counter() - start) * 1000)

        return PredictionResult(
            prediction=label,
            confidence=confidence,
            processing_time_ms=elapsed_ms,
            model_version=MODEL_VERSION,
            details={
                "probabilities": {
                    "noise": float(round(proba[0], 4)),
                    "earthquake": float(round(proba[1], 4)),
                    "unknown": float(round(proba[2], 4)),
                },
                "feature_keys": list(FEATURE_KEYS),
                "input_magnitude": float(features.get("magnitude", 0.0) or 0.0),
                "input_sta_lta": float(features.get("sta_lta_ratio", 0.0) or 0.0),
            },
        )


model = Model()
