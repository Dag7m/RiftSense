"""Unit tests for ML model inference (feature vector -> classification)."""

from __future__ import annotations

import pytest

from app.model import FEATURE_KEYS, ID_TO_LABEL, Model, _vectorize


@pytest.fixture(scope="module")
def loaded_model() -> Model:
    m = Model()
    m.load()
    assert m.loaded
    return m


def test_model_loads():
    m = Model()
    m.load()
    assert m.loaded
    assert m.version


def test_vectorize_order_matches_feature_keys():
    feats = {k: float(i + 1) for i, k in enumerate(FEATURE_KEYS)}
    vec = _vectorize(feats)
    assert len(vec) == len(FEATURE_KEYS)
    assert vec[0] == feats["magnitude"]


def test_earthquake_like_features_classified(loaded_model: Model):
    result = loaded_model.predict(
        {
            "magnitude": 1.2,
            "avg_magnitude": 0.15,
            "std_magnitude": 0.3,
            "peak_acceleration": 1.2,
            "duration_ms": 54900,
            "sample_count": 550,
            "sta_lta_ratio": 40.0,
        }
    )
    assert result.prediction in ID_TO_LABEL.values()
    assert result.prediction == "earthquake"
    assert 0.0 < result.confidence <= 0.99
    assert result.model_version
    assert "probabilities" in result.details


def test_noise_like_features_classified(loaded_model: Model):
    result = loaded_model.predict(
        {
            "magnitude": 0.02,
            "avg_magnitude": 0.015,
            "std_magnitude": 0.005,
            "peak_acceleration": 0.02,
            "duration_ms": 54900,
            "sample_count": 550,
            "sta_lta_ratio": 1.0,
        }
    )
    assert result.prediction == "noise"


def test_unknown_like_features_classified(loaded_model: Model):
    result = loaded_model.predict(
        {
            "magnitude": 0.15,
            "avg_magnitude": 0.08,
            "std_magnitude": 0.04,
            "peak_acceleration": 0.15,
            "duration_ms": 54900,
            "sample_count": 550,
            "sta_lta_ratio": 2.0,
        }
    )
    assert result.prediction == "unknown"


def test_predict_returns_all_probability_keys(loaded_model: Model):
    result = loaded_model.predict(
        {
            "magnitude": 0.5,
            "avg_magnitude": 0.1,
            "std_magnitude": 0.2,
            "peak_acceleration": 0.5,
            "duration_ms": 1000,
            "sample_count": 550,
            "sta_lta_ratio": 5.0,
        }
    )
    probs = result.details["probabilities"]
    assert set(probs.keys()) == {"noise", "earthquake", "unknown"}
