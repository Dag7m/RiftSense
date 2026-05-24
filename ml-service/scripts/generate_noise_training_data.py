#!/usr/bin/env python3
"""
Generate noise-labeled training examples for Random Forest.

Each example is one 550-point x/y/z window of steady low background vibration
(no STA/LTA trigger spike), converted to 7 features + label.

Outputs:
  training_data/noise_features_500.csv
  training_data/noise_events_500.json   (optional, --include-raw)

Usage:
  python scripts/generate_noise_training_data.py
  python scripts/generate_noise_training_data.py --count 500 --include-raw
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

NODE_ID = "ESP32_NODE_001"
SAMPLING_RATE = 100
INTERVAL_MS = 100
TOTAL_POINTS = 550  # same window size as earthquake / backend STA+LTA minimum

STA_WINDOW = 50
LTA_WINDOW = 500

FEATURE_KEYS = (
    "magnitude",
    "avg_magnitude",
    "std_magnitude",
    "peak_acceleration",
    "duration_ms",
    "sample_count",
    "sta_lta_ratio",
    "label",
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = SCRIPT_DIR.parent / "training_data"


def magnitude_xyz(x: float, y: float, z: float) -> float:
    return float(np.sqrt(x * x + y * y + z * z))


def sta_lta_ratio_at_end(magnitudes: np.ndarray) -> float:
    m = np.asarray(magnitudes, dtype=float)
    if len(m) < STA_WINDOW + LTA_WINDOW:
        return 0.0

    idx = len(m) - 1
    sta_sum = np.sum(np.abs(m[idx - STA_WINDOW + 1 : idx + 1]))
    sta = sta_sum / STA_WINDOW

    lta_start = max(0, idx - LTA_WINDOW - STA_WINDOW + 1)
    lta_end = idx - STA_WINDOW
    lta_slice = m[lta_start : lta_end + 1]
    lta_val = float(np.mean(np.abs(lta_slice))) if len(lta_slice) else 1.0
    if lta_val == 0:
        return float("inf") if sta > 0 else 0.0
    return float(sta / lta_val)


def extract_features(times_ms: np.ndarray, magnitudes: np.ndarray) -> dict[str, float]:
    if len(magnitudes) == 0:
        return {k: 0.0 for k in FEATURE_KEYS if k != "label"}

    m = np.asarray(magnitudes, dtype=float)
    t = np.asarray(times_ms, dtype=float)
    avg = float(np.mean(m))
    std = float(np.std(m))
    mx = float(np.max(m))
    duration = float(t[-1] - t[0]) if len(t) > 1 else 0.0

    return {
        "magnitude": mx,
        "peak_acceleration": mx,
        "avg_magnitude": avg,
        "std_magnitude": std,
        "duration_ms": duration,
        "sample_count": float(len(m)),
        "sta_lta_ratio": 0.0,
    }


def _unit_direction(rng: np.random.Generator) -> np.ndarray:
    v = rng.normal(size=3)
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else np.array([1.0, 0.0, 0.0])


def _xyz_from_scalar(rng: np.random.Generator, scalar: float, direction: np.ndarray) -> tuple[float, float, float]:
    jitter = 1.0 + rng.normal(0, 0.03, size=3)
    x, y, z = scalar * direction * jitter
    return float(x), float(y), float(z)


def generate_noise_window(seed: int) -> list[dict]:
    """
    Steady low-magnitude background for all 550 samples (like generate_test_data.js
    background only — no high-magnitude trigger tail).
    """
    rng = np.random.default_rng(seed)
    direction = _unit_direction(rng)
    bg_base = rng.uniform(0.008, 0.02)

    batch_end = datetime.now(timezone.utc)
    batch_start = batch_end - timedelta(milliseconds=(TOTAL_POINTS - 1) * INTERVAL_MS)

    points: list[dict] = []
    for i in range(TOTAL_POINTS):
        variation = (rng.random() - 0.5) * 0.014
        scalar = max(0.001, min(0.038, bg_base + variation))
        x, y, z = _xyz_from_scalar(rng, scalar, direction)
        ts = batch_start + timedelta(milliseconds=i * INTERVAL_MS)
        points.append(
            {
                "x": round(x, 6),
                "y": round(y, 6),
                "z": round(z, 6),
                "timestamp": ts.isoformat().replace("+00:00", "Z"),
            }
        )
    return points


def window_to_feature_row(data: list[dict], label: str = "noise") -> dict[str, float | str]:
    times_ms = np.array(
        [datetime.fromisoformat(p["timestamp"].replace("Z", "+00:00")).timestamp() * 1000 for p in data],
        dtype=float,
    )
    mags = np.array([magnitude_xyz(p["x"], p["y"], p["z"]) for p in data], dtype=float)
    feats = extract_features(times_ms, mags)
    feats["sta_lta_ratio"] = round(sta_lta_ratio_at_end(mags), 4)
    feats["label"] = label
    for k in ("magnitude", "peak_acceleration", "avg_magnitude", "std_magnitude"):
        feats[k] = round(float(feats[k]), 6)
    feats["duration_ms"] = round(float(feats["duration_ms"]), 1)
    feats["sample_count"] = float(feats["sample_count"])
    return feats


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate noise training data for Random Forest.")
    parser.add_argument("--count", type=int, default=500, help="Number of noise events (default: 500)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--include-raw", action="store_true")
    parser.add_argument("--seed", type=int, default=1042, help="Base seed (offset from earthquake generator)")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = args.output_dir / f"noise_features_{args.count}.csv"
    rows: list[dict[str, float | str]] = []
    raw_events: list[dict] = []

    print(f"Generating {args.count} noise events ({TOTAL_POINTS} xyz points each)...")

    for i in range(args.count):
        data = generate_noise_window(seed=args.seed + i)
        row = window_to_feature_row(data, label="noise")
        row["event_id"] = i + 1
        rows.append(row)
        if args.include_raw:
            raw_events.append(
                {
                    "event_id": i + 1,
                    "label": "noise",
                    "node_id": NODE_ID,
                    "sampling_rate": SAMPLING_RATE,
                    "data": data,
                }
            )

    fieldnames = ["event_id", *FEATURE_KEYS]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    ratios = [float(r["sta_lta_ratio"]) for r in rows]
    print(f"\nWrote {len(rows)} feature rows -> {csv_path}")
    print(f"  sta_lta_ratio: min={min(ratios):.2f}, max={max(ratios):.2f}, mean={np.mean(ratios):.2f}")
    print(f"  magnitude:     min={min(r['magnitude'] for r in rows):.3f}, max={max(r['magnitude'] for r in rows):.3f}")

    if args.include_raw:
        json_path = args.output_dir / f"noise_events_{args.count}.json"
        payload = {
            "description": "Synthetic noise windows for RiftSense ML training",
            "label": "noise",
            "points_per_event": TOTAL_POINTS,
            "event_count": args.count,
            "events": raw_events,
        }
        json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Wrote raw events      -> {json_path}")

    print("\nCombine with earthquake_features_500.csv (and unknown) before training.")


if __name__ == "__main__":
    main()
