# RiftSense — Software Architecture

Service-oriented design across firmware, backend, machine learning, and frontend. Inter-service communication uses JSON REST APIs.

## High-level architecture

```mermaid
flowchart TB
  subgraph edge["Firmware layer"]
    FW["ESP32 + MPU6050"]
    FW_TX["Acquire · buffer · timestamp · WiFi TX"]
    FW --> FW_TX
  end

  subgraph backend["Backend layer — Node.js · Express"]
    API["REST API gateway"]
    MW["Validation · JWT auth · routing"]
    CTRL["Sensor controller<br/>ingestData · ingestBatchData"]
    STA["STA/LTA detection"]
    FE["Feature extraction"]
    API --> MW --> CTRL
    CTRL --> STA --> FE
  end

  subgraph ml["Machine learning layer — FastAPI"]
    ML["POST /predict<br/>Random Forest classifier"]
  end

  subgraph store["Persistence — PostgreSQL / TimescaleDB"]
    DB1["sensor_data"]
    DB2["predictions"]
    DB3["events · event_detections"]
  end

  subgraph ui["Frontend layer — Next.js dashboard"]
    UI["Dashboard · maps · felt reports · admin"]
  end

  FW_TX -->|"JSON REST"| API
  UI -->|"JSON REST"| API

  CTRL -->|"1. insert first"| DB1
  FE -->|"2. JSON REST features"| ML
  ML -->|"3. response"| CTRL
  CTRL -->|"4. after ML OK"| DB2
  CTRL -->|"5. if rules pass"| DB3

  MW -.->|"read/write other routes"| DB1
  MW -.-> DB3
```

**Note:** ML does **not** call back into validation/routing. The **sensor controller** calls ML, receives the response, then writes `predictions` and optionally `events`. Raw `sensor_data` is written **before** STA/LTA and ML (batch and single ingest).
```

## Layer responsibilities

```mermaid
flowchart LR
  subgraph L1["Firmware"]
    A1["Acquire & timestamp vibration data"]
    A2["Transmit to backend"]
  end

  subgraph L2["Backend"]
    B1["Validate & authenticate requests"]
    B2["STA/LTA + feature pipeline"]
    B3["Orchestrate ML classification"]
    B4["Store sensor data · events · predictions"]
  end

  subgraph L3["ML service"]
    C1["Supervised Random Forest"]
    C2["Classify earthquake vs noise vs unknown"]
  end

  subgraph L4["Frontend"]
    D1["Visualize data & events"]
    D2["Admin & felt-report UX"]
  end

  L1 -->|REST JSON| L2
  L2 -->|REST JSON| L3
  L3 --> L2
  L4 -->|REST JSON| L2
```

## Deployment / runtime view

```mermaid
flowchart TB
  ESP["ESP32 firmware<br/>: WiFi client"]
  NODE["Node.js backend<br/>:5000 or configured port"]
  PG["PostgreSQL + TimescaleDB"]
  PY["ml-service FastAPI<br/>:5000"]
  WEB["Next.js frontend<br/>:3000"]

  ESP -->|POST /api/sensors/data| NODE
  NODE --> PG
  NODE -->|ML_ENABLED · /predict| PY
  WEB -->|HTTPS/HTTP API| NODE

  classDef store fill:#e8f4e8
  class PG store
```

## Request flow — sensor ingest to UI

```mermaid
sequenceDiagram
  participant F as Firmware
  participant B as Backend Express
  participant DB as Database
  participant M as ML service
  participant W as Frontend dashboard

  F->>B: JSON REST — sensor sample / batch
  B->>B: Validate · route · STA/LTA · features
  B->>DB: INSERT sensor_data
  B->>M: JSON REST — feature vector
  M-->>B: classification + confidence
  B->>DB: INSERT predictions
  opt event rules satisfied
    B->>DB: INSERT or UPDATE events
  end
  W->>B: JSON REST — events · nodes · stats · felt reports
  B-->>W: JSON — maps · trends · health metrics
```
