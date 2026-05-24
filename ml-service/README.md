# RiftSense ML Service

FastAPI sidecar that scores RiftSense feature vectors and returns
`{ prediction, confidence, processing_time_ms, model_version, details }`.

The Node backend's [`backend/src/utils/mlClient.js`](../backend/src/utils/mlClient.js)
calls `POST /predict` when `ML_ENABLED=true` and falls back to its built-in
placeholder if this service is unreachable or slow.

## scikit-learn version (Colab ↔ local)

Joblib models must be loaded with the **same scikit-learn version** they were trained with.

- This repo pins **`scikit-learn==1.6.1`** in `requirements.txt` (typical Colab).
- If you see `InconsistentVersionWarning` (e.g. trained on 1.6.1, running 1.7.2), either:
  1. `pip install scikit-learn==1.6.1` in your ml-service venv, **or**
  2. In Colab before training: `!pip install scikit-learn==1.6.1`, re-export `riftsense_model.joblib`, **or**
  3. Retrain locally: `python scripts/train_model.py` (uses your local sklearn).

Place the file at `artifacts/riftsense_model.joblib` (not `riftsense_model1.joblib` unless you set `MODEL_ARTIFACT_PATH`).

### Colab: pin sklearn before train

```python
!pip install scikit-learn==1.6.1
```

## Train model (Random Forest)

After generating training CSVs (`training_data/riftsense_train_1500.csv`):

```bash
cd ml-service
pip install -r requirements.txt
python scripts/train_model.py
```

This writes `artifacts/riftsense_model.joblib`. The service loads it on startup.

## Run locally

```bash
cd ml-service
python -m venv .venv
. .venv/Scripts/activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/train_model.py   # if artifacts/ is missing
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

Health check:

```bash
curl http://localhost:5000/health
```

Sample prediction:

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"features":{"magnitude":0.42,"avg_magnitude":0.08,"std_magnitude":0.11,"peak_acceleration":0.45,"duration_ms":12000,"sample_count":400,"sta_lta_ratio":4.2}}'
```

## Run with Docker

```bash
docker build -t riftsense-ml ./ml-service
docker run --rm -p 5000:5000 riftsense-ml
```

## Contract

Request body (either nested or flat):

```json
{
  "features": {
    "magnitude": 0.42,
    "avg_magnitude": 0.08,
    "std_magnitude": 0.11,
    "peak_acceleration": 0.45,
    "duration_ms": 12000,
    "sample_count": 400,
    "sta_lta_ratio": 4.2
  }
}
```

Response:

```json
{
  "prediction": "earthquake",
  "confidence": 0.83,
  "processing_time_ms": 4,
  "model_version": "v2-rf-riftsense-1500",
  "details": { "probabilities": { "noise": 0.05, "earthquake": 0.9, "unknown": 0.05 } }
}
```

## Model

Default: **Random Forest** loaded from `artifacts/riftsense_model.joblib`
(trained via [`scripts/train_model.py`](scripts/train_model.py) on
[`training_data/riftsense_train_1500.csv`](training_data/riftsense_train_1500.csv)).

If the artifact is missing, the service falls back to a small synthetic
`LogisticRegression` for development.

Retrain after adding new labelled rows:

```bash
python scripts/merge_training_data.py
python scripts/train_model.py
```
