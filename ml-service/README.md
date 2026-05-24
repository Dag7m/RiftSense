# RiftSense ML Service

FastAPI sidecar that scores RiftSense feature vectors and returns
`{ prediction, confidence, processing_time_ms, model_version, details }`.

The Node backend's [`backend/src/utils/mlClient.js`](../backend/src/utils/mlClient.js)
calls `POST /predict` when `ML_ENABLED=true` and falls back to its built-in
placeholder if this service is unreachable or slow.

## Run locally

```bash
cd ml-service
python -m venv .venv
. .venv/Scripts/activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
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
  "model_version": "v1-logreg-synthetic",
  "details": { "probabilities": { "earthquake": 0.83, "noise": 0.1, "unknown": 0.07 } }
}
```

## Model

`v1-logreg-synthetic` is a `scikit-learn` `LogisticRegression` trained at
startup on a synthetic dataset shaped like the feature vector above. Replace
[`app/model.py`](app/model.py) with a real trained model when you have
labelled RiftSense data; keep the same `Model.predict` signature and response
shape and nothing else has to change.
