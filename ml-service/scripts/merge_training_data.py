#!/usr/bin/env python3
"""
Merge per-label feature CSVs into one training file.

Usage:
  python scripts/merge_training_data.py
  python scripts/merge_training_data.py --output training_data/riftsense_train_1500.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DIR = SCRIPT_DIR.parent / "training_data"
DEFAULT_INPUTS = [
    "earthquake_features_500.csv",
    "noise_features_500.csv",
    "unknown_features_500.csv",
]

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


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge label CSVs for ML training.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_DIR)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_DIR / "riftsense_train_1500.csv",
    )
    parser.add_argument("--files", nargs="*", default=DEFAULT_INPUTS)
    args = parser.parse_args()

    rows: list[dict[str, str]] = []
    for name in args.files:
        path = args.input_dir / name
        with path.open(newline="", encoding="utf-8") as f:
            part = list(csv.DictReader(f))
            rows.extend(part)
            print(f"  + {len(part)} from {name}")

    rng = np.random.default_rng(42)
    indices = rng.permutation(len(rows))
    shuffled = [rows[i] for i in indices]

    fieldnames = list(FEATURE_KEYS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(shuffled)

    labels = [r["label"] for r in shuffled]
    from collections import Counter

    counts = Counter(labels)
    print(f"\nWrote {len(shuffled)} rows -> {args.output}")
    print(f"  label counts: {dict(counts)}")


if __name__ == "__main__":
    main()
