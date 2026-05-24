#!/usr/bin/env python3
"""
Train Random Forest on riftsense_train_1500.csv and save a joblib bundle for ml-service.

Usage:
  python scripts/train_model.py
  python scripts/train_model.py --csv training_data/riftsense_train_1500.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURE_KEYS = (
    "magnitude",
    "avg_magnitude",
    "std_magnitude",
    "peak_acceleration",
    "duration_ms",
    "sample_count",
    "sta_lta_ratio",
)

# Must match backend / model.py class indices for predict_proba mapping
LABEL_TO_ID = {"noise": 0, "earthquake": 1, "unknown": 2}
ID_TO_LABEL = {v: k for k, v in LABEL_TO_ID.items()}

MODEL_VERSION = "v2-rf-riftsense-1500"

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CSV = SCRIPT_DIR.parent / "training_data" / "riftsense_train_1500.csv"
DEFAULT_ARTIFACT = SCRIPT_DIR.parent / "artifacts" / "riftsense_model.joblib"


def load_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    rows = []
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            label = row["label"].strip().lower()
            if label not in LABEL_TO_ID:
                continue
            x = [float(row[k]) for k in FEATURE_KEYS]
            rows.append((x, LABEL_TO_ID[label]))

    if not rows:
        raise ValueError(f"No valid rows in {path}")

    X = np.array([r[0] for r in rows], dtype=float)
    y = np.array([r[1] for r in rows], dtype=int)
    return X, y


def main() -> None:
    parser = argparse.ArgumentParser(description="Train RiftSense Random Forest.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--output", type=Path, default=DEFAULT_ARTIFACT)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    X, y = load_csv(args.csv)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=args.seed,
        n_jobs=-1,
    )
    clf.fit(X_train_s, y_train)

    y_pred = clf.predict(X_test_s)
    print(classification_report(y_test, y_pred, target_names=[ID_TO_LABEL[i] for i in sorted(ID_TO_LABEL)]))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model_version": MODEL_VERSION,
        "model_type": "random_forest",
        "sklearn_version": sklearn.__version__,
        "feature_keys": FEATURE_KEYS,
        "label_to_id": LABEL_TO_ID,
        "id_to_label": ID_TO_LABEL,
        "scaler": scaler,
        "clf": clf,
    }
    joblib.dump(bundle, args.output)
    print(f"\nSaved -> {args.output}")


if __name__ == "__main__":
    main()
