"""
RiftSense ML model.

Loads a trained Random Forest from artifacts/riftsense_model.joblib when present.
Falls back to a small synthetic LogisticRegression for local dev without training.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.base import ClassifierMixin
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

DEFAULT_MODEL_VERSION = "v1-logreg-synthetic-fallback"

FEATURE_KEYS = (
    "magnitude",
    "avg_magnitude",
    "std_magnitude",
    "peak_acceleration",
    "duration_ms",
    "sample_count",
    "sta_lta_ratio",
)

# Class indices used in training (train_model.py) and predict_proba mapping
LABEL_TO_ID = {"noise": 0, "earthquake": 1, "unknown": 2}
ID_TO_LABEL = {0: "noise", 1: "earthquake", 2: "unknown"}

ARTIFACT_PATH = Path(
    os.environ.get(
        "MODEL_ARTIFACT_PATH",
        str(Path(__file__).resolve().parent.parent / "artifacts" / "riftsense_model.joblib"),
    )
)


def _vectorize(features: dict[str, Any]) -> np.ndarray:
    return np.array(
        [float(features.get(key, 0.0) or 0.0) for key in FEATURE_KEYS],
        dtype=float,
    )


def _generate_synthetic_dataset(n: int = 1500, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
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
    y = np.array([0] * per_class + [1] * per_class + [2] * per_class, dtype=int)
    return X, y


@dataclass
class PredictionResult:
    prediction: str
    confidence: float
    processing_time_ms: int
    model_version: str
    details: dict[str, Any]


class Model:
    """Random Forest (from joblib) or synthetic LogisticRegression fallback."""

    def __init__(self) -> None:
        self._scaler: StandardScaler | None = None
        self._clf: ClassifierMixin | None = None
        self._id_to_label: dict[int, str] = dict(ID_TO_LABEL)
        self._model_version: str = DEFAULT_MODEL_VERSION
        self._loaded = False

    def load(self) -> None:
        if ARTIFACT_PATH.is_file():
            bundle = joblib.load(ARTIFACT_PATH)
            self._scaler = bundle["scaler"]
            self._clf = bundle["clf"]
            self._id_to_label = {int(k): v for k, v in bundle["id_to_label"].items()}
            self._model_version = bundle.get("model_version", "v2-rf-trained")
            self._loaded = True
            return

        scaler = StandardScaler()
        clf = LogisticRegression(max_iter=500, solver="lbfgs")
        X, y = _generate_synthetic_dataset()
        scaler.fit(X)
        clf.fit(scaler.transform(X), y)
        self._scaler = scaler
        self._clf = clf
        self._id_to_label = dict(ID_TO_LABEL)
        self._model_version = DEFAULT_MODEL_VERSION
        self._loaded = True

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def version(self) -> str:
        return self._model_version

    def _probabilities_dict(self, proba_row: np.ndarray) -> dict[str, float]:
        assert self._clf is not None
        out: dict[str, float] = {name: 0.0 for name in ID_TO_LABEL.values()}
        for idx, class_id in enumerate(self._clf.classes_):
            label = self._id_to_label[int(class_id)]
            out[label] = float(round(proba_row[idx], 4))
        return out

    def predict(self, features: dict[str, Any]) -> PredictionResult:
        if not self._loaded:
            self.load()

        assert self._scaler is not None and self._clf is not None

        start = time.perf_counter()
        vec = _vectorize(features).reshape(1, -1)
        scaled = self._scaler.transform(vec)
        proba = self._clf.predict_proba(scaled)[0]
        idx = int(np.argmax(proba))
        class_id = int(self._clf.classes_[idx])
        label = self._id_to_label[class_id]
        confidence = float(round(min(0.99, max(0.01, proba[idx])), 4))
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        return PredictionResult(
            prediction=label,
            confidence=confidence,
            processing_time_ms=elapsed_ms,
            model_version=self._model_version,
            details={
                "probabilities": self._probabilities_dict(proba),
                "feature_keys": list(FEATURE_KEYS),
                "input_magnitude": float(features.get("magnitude", 0.0) or 0.0),
                "input_sta_lta": float(features.get("sta_lta_ratio", 0.0) or 0.0),
            },
        )


model = Model()
