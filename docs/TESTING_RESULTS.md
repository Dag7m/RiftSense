# RiftSense — Testing and Validation (Chapter 7 evidence)

Run these commands locally and capture terminal screenshots for your thesis.

## 7.1 Testing strategy (summary)

| Layer | Approach |
|-------|----------|
| Unit | Isolated modules (STA/LTA, feature extraction, Joi schemas, ML inference) |
| Integration | Postman batch ingest, ML `/health`, DB queries (manual) |
| System | ESP32 or batch JSON → backend → ML → DB → frontend dashboard |

## 7.2 Unit testing — automated results

### How to reproduce

**Backend (Node.js built-in test runner):**

```powershell
cd backend
npm run test:report
```

**ML service (pytest):**

```powershell
cd ml-service
.\.venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

### Table 7.1 — Unit test modules (automated, May 2026 run)

| Module | Test file | Tests | Result |
|--------|-----------|-------|--------|
| STA/LTA detection | `backend/tests/staLta.test.js` | 4 | **Passed** |
| Feature extraction | `backend/tests/mlClient.test.js` | 4 | **Passed** |
| API validation (Joi) | `backend/tests/validators.test.js` | 4 | **Passed** |
| ML inference | `ml-service/tests/test_model_inference.py` | 6 | **Passed** |
| **Total automated** | | **18** | **18 passed, 0 failed** |

### Table 7.2 — What each module verifies

| Module | Test focus | Evidence |
|--------|------------|----------|
| STA/LTA | 550-sample window, trigger on quake fixture, no trigger on noise | Uses `test_batch_550_*.json` |
| ML client | `extractFeatures`: sample_count, magnitude ordering noise < unknown < quake | Same fixtures |
| Validators | `node_id`, batch shape, reject empty `data` | Joi schemas |
| ML model | Load joblib/fallback, classify earthquake/noise/unknown feature vectors | `app.model.Model.predict` |

### Backend test output (paste into thesis or screenshot)

```
ℹ tests 12
ℹ suites 3
ℹ pass 12
ℹ fail 0
```

Key assertions:
- Earthquake batch: STA/LTA **triggered**, ratio ≥ 3
- Noise batch: STA/LTA **not triggered**, ratio < 3
- Noise peak magnitude < earthquake peak magnitude

### ML test output (paste into thesis or screenshot)

```
6 passed in ~12s
test_earthquake_like_features_classified PASSED
test_noise_like_features_classified PASSED
test_unknown_like_features_classified PASSED
```

## 7.3 Integration testing — checklist for screenshots

| Step | Action | Screenshot idea |
|------|--------|-----------------|
| 1 | `curl http://localhost:5000/health` | ML service healthy, `model_version` |
| 2 | Postman `POST /api/sensors/data/batch` with `test_batch_550_points.json` | `detection.ml_called: true`, `prediction: earthquake` |
| 3 | Post `test_batch_550_noise_points.json` | `prediction: noise`, `event_created: false` |
| 4 | SQL `SELECT * FROM predictions ORDER BY created_at DESC LIMIT 5` | Prediction rows |
| 5 | Frontend events map / admin dashboard | Live UI |

**Figure 7.2 caption:** Successful integration — batch ingest, ML classification, and persistence.

## 7.4 System testing — checklist

| Scenario | Input | Expected |
|----------|-------|----------|
| Strong motion | `test_batch_550_points.json` | Event + prediction `earthquake` |
| Background noise | `test_batch_550_noise_points.json` | Prediction `noise`, usually no event |
| Ambiguous | `test_batch_550_unknown_points.json` | Prediction `unknown` |
| Felt report | Frontend `/felt-it` | Row in `felt_reports` |

## 7.5 Test tools (Table for thesis)

| Tool | Purpose in RiftSense |
|------|----------------------|
| Node.js `node --test` | Backend unit tests |
| pytest | ML unit tests |
| Postman | REST API integration |
| PostgreSQL client (psql / pgAdmin) | `sensor_data`, `predictions`, `events` |
| Serial monitor | ESP32 firmware diagnostics |
| Google Colab | ML training and export `.joblib` |
| Browser DevTools | Frontend network tab, dashboard |

## 7.6 Performance metrics (fill from your measurements)

| Metric | How to measure | Your value |
|--------|----------------|------------|
| Batch ingest + detection latency | Postman response time | ______ ms |
| ML `/predict` latency | `processing_time_ms` in response | ______ ms |
| DB insert (550 rows) | Server logs / timing | ______ |
| ML hold-out accuracy (synthetic) | Colab classification report | 100% (synthetic)* |

\*Synthetic training data; report separately for live ESP32 data.

## 7.7 Validation outcome (draft text)

Automated unit testing (**18/18 passed**) confirmed STA/LTA behavior on labeled batch fixtures, consistent seven-feature extraction, valid API schemas, and correct Random Forest inference for earthquake-, noise-, and unknown-like inputs. Integration and system validation should be documented with Postman responses, database query screenshots, and dashboard figures per Section 7.3–7.4 above.

---

## Files added for testing

```
backend/tests/staLta.test.js
backend/tests/mlClient.test.js
backend/tests/validators.test.js
backend/tests/helpers/batchFixture.js
ml-service/tests/test_model_inference.py
```
