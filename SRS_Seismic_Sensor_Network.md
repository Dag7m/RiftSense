## Software Requirements Specification (SRS)

## Seismic Sensor Network with Real-Time Monitoring, Machine Learning Classification, and Crowd-Sourced Felt Reports

### Document Control

- **Document ID**: SRS-SSN-RTML-FELT
- **Standard Alignment**: IEEE 830 (legacy structure) and ISO/IEC/IEEE 29148 (requirements quality and lifecycle considerations)
- **Version**: 1.0
- **Date**: 2026-01-26
- **Status**: Baseline (Thesis)
- **Audience**: Thesis committee, project supervisors, developers, testers, stakeholders

### Revision History

| Version | Date | Author(s) | Description |
|---:|---|---|---|
| 0.1 | 2026-01-26 | Project Team | Initial draft structure |
| 1.0 | 2026-01-26 | Project Team | Consolidated baseline SRS |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the requirements for the thesis project titled **“Seismic Sensor Network with Real-Time Monitoring, Machine Learning Classification, and Crowd-Sourced Felt Reports.”** The SRS specifies functional and non-functional requirements, external interfaces, data requirements, system models, and acceptance criteria for the complete system, from sensor nodes to backend services, machine learning integration, and the frontend user interface.

### 1.2 Scope

The system is a distributed seismic monitoring platform that:

- Collects ground motion data via ESP32-based sensor nodes equipped with accelerometers.
- Ingests and stores time-series sensor data in **PostgreSQL + TimescaleDB**.
- Performs real-time and historical analysis, including **ML-based classification** (earthquake vs. noise).
- Generates alerts based on thresholds and ML results.
- Provides a web-based (Next.js) frontend for real-time monitoring, historical visualization, sensor status, and public engagement via a **“Felt It”** reporting feature.

The system supports multiple user roles (anonymous, registered user, admin) and provides APIs for sensor nodes, frontend consumption, and ML services.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| ESP32 | Microcontroller platform with Wi-Fi/BLE used for sensor nodes |
| Accelerometer | Sensor measuring acceleration on X/Y/Z axes |
| TimescaleDB | PostgreSQL extension optimized for time-series data |
| Hypertable | TimescaleDB logical abstraction for partitioned time-series tables |
| STA/LTA | Short-term average / long-term average seismic trigger heuristic |
| ML | Machine Learning |
| “Felt It” report | Crowdsourced report describing perceived shaking |
| API | Application Programming Interface |
| JWT | JSON Web Token (auth mechanism) |
| SLA | Service Level Agreement (targets in this thesis context) |

### 1.4 References

- ISO/IEC/IEEE 29148: Systems and software engineering — Life cycle processes — Requirements engineering
- IEEE 830: Recommended Practice for Software Requirements Specifications (legacy guidance)
- PostgreSQL documentation (data types, indexing, roles)
- TimescaleDB documentation (hypertables, continuous aggregates)

### 1.5 Document Overview

This SRS is organized into:

- **Overall description** of the product, constraints, assumptions, and stakeholders.
- **System features and functional requirements** (FR-x) grouped by subsystem.
- **Non-functional requirements** (NFR-x) including performance, security, reliability, usability.
- **External interface requirements** (IF-x) specifying data formats and protocols.
- **Data requirements** (DR-x) including conceptual schema and time-series handling.
- **System models** (use cases, workflows, state models, and data flows).
- **Acceptance criteria** mapping testable outcomes to requirements.

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a multi-component solution comprising:

- **Hardware Layer**: ESP32 sensor nodes with accelerometers, installed at multiple sites.
- **Backend System**: Node/Express-based server handling ingestion, storage, analytics orchestration, role-based APIs, and admin functions.
- **Database Layer**: PostgreSQL with TimescaleDB extension for time-series storage and aggregates.
- **Machine Learning Component**: Classifies seismic signals; invoked in real time and for historical analysis.
- **Frontend Application**: Next.js web interface for monitoring, visualization, and reporting.

The system integrates across network boundaries, using HTTP(S) APIs, JSON payloads, and database queries/aggregates to support real-time workflows.

### 2.2 Product Functions (High-Level)

- Register and manage sensor nodes and their health/status.
- Ingest single and batch seismic sensor readings with timestamps and sampling metadata.
- Store and retrieve time-series sensor data efficiently (hypertables, indexing, aggregates).
- Detect candidate events via thresholding and/or STA/LTA heuristics.
- Classify signals using an ML model; store predictions and associated features.
- Create and manage seismic events and sensor detections linked to events.
- Provide user authentication (register/login/refresh/logout) and role-based access control.
- Enable crowd-sourced “Felt It” reporting with optional authentication.
- Provide admin dashboard, logs, and database health insights.

### 2.3 User Classes and Characteristics

- **Anonymous User**: Unauthenticated; can view public dashboards (as configured) and submit anonymous felt reports.
- **Registered User**: Authenticated; can view richer data, receive alerts (where supported), and submit felt reports linked to their account.
- **Admin User**: Authenticated with elevated privileges; manages nodes, reviews reports/events, monitors system health, and performs data cleanup.
- **Sensor Node (Device Client)**: Uses ingestion and heartbeat endpoints; subject to device rate limits and payload validation.
- **ML Service (System Actor)**: Receives feature payloads from backend; returns classification results.

### 2.4 Operating Environment

- **Sensor Nodes**: ESP32 microcontroller environment; intermittent connectivity possible.
- **Backend**: Runs on a server or containerized environment; targets Node.js LTS runtime.
- **Database**: PostgreSQL + TimescaleDB; runs in Docker for development and can be deployed to managed services.
- **Frontend**: Modern web browser; responsive design support for desktop and mobile.

### 2.5 Design and Implementation Constraints

- **C-1**: System must support time-series storage using PostgreSQL with TimescaleDB extension.
- **C-2**: Sensor nodes may operate on limited bandwidth; payloads must be compact and robust to intermittent connectivity.
- **C-3**: Authentication uses token-based approach (e.g., JWT) for APIs.
- **C-4**: Thesis scope requires reproducible deployment (Docker recommended) and traceable requirements-to-tests mapping.

### 2.6 Assumptions and Dependencies

- **A-1**: Sensor nodes can timestamp measurements (or backend can assign timestamps) using synchronized or approximate clocks.
- **A-2**: Internet connectivity exists between nodes and backend at least intermittently.
- **A-3**: ML model and feature extraction are available as a service/API (local or remote).
- **A-4**: Geospatial “nearby” features assume sufficient accuracy in node location metadata.

### 2.7 Stakeholders

- Research supervisors and thesis committee
- System administrators
- Field technicians deploying sensor nodes
- End users (public and registered)

---

## 3. External Interface Requirements

### 3.1 User Interfaces (UI)

- **UI-1**: Frontend shall provide a real-time dashboard showing sensor node statuses (active/inactive/maintenance), last heartbeat, and basic statistics.
- **UI-2**: Frontend shall provide waveform visualization (real-time and historical) per node with selectable time windows.
- **UI-3**: Frontend shall provide map-based visualization of sensor locations and nearby events.
- **UI-4**: Frontend shall provide an alerts panel with filters and severity indicators.
- **UI-5**: Frontend shall provide a “Felt It” submission form with intensity scale guidance.
- **UI-6**: Frontend shall provide admin pages for node management, event/reports review, and database/system health.

### 3.2 Hardware Interfaces

- **HW-1**: Sensor node shall interface with an accelerometer capable of sampling at configured rates (e.g., 50–200 Hz, configurable).
- **HW-2**: Sensor node shall interface with Wi‑Fi (or equivalent) to transmit data to backend.
- **HW-3**: Sensor node shall expose battery level and firmware version information (where available) via heartbeat.

### 3.3 Software Interfaces

- **SW-1**: Backend shall interface with PostgreSQL/TimescaleDB for data storage, hypertable operations, and aggregate queries.
- **SW-2**: Backend shall interface with ML service via HTTP(S) requests sending extracted features or waveform segments and receiving predictions.
- **SW-3**: Backend shall interface with frontend via REST APIs returning JSON responses.
- **SW-4**: Backend shall interface with logging and monitoring tools (files/console; optional integration with centralized logging).

### 3.4 Communication Interfaces

- **COM-1**: Sensor nodes shall communicate with backend using HTTP(S) over TCP/IP.
- **COM-2**: Payloads shall be encoded in JSON with UTF‑8.
- **COM-3**: Backend shall enforce rate limiting on sensor ingestion endpoints to mitigate abuse.
- **COM-4**: Backend and frontend shall use HTTPS in production deployments.

---

## 4. System Features and Functional Requirements

### Requirements Notation and Quality

- Requirements use **“shall”** statements and are intended to be testable.
- Each requirement is uniquely identified (FR-x, NFR-x, IF-x, DR-x).

### 4.1 Sensor Data Ingestion

- **FR-1**: The backend shall accept single sensor data ingestion requests containing `node_id`, `x`, `y`, `z`, optional `sampling_rate`, and optional `timestamp`.
- **FR-2**: The backend shall accept batch ingestion requests containing `node_id`, `sampling_rate`, and an array of `(x, y, z, timestamp)` samples.
- **FR-3**: The backend shall validate sensor payloads for type, range, and required fields and reject invalid payloads with a 4xx response and descriptive error.
- **FR-4**: The backend shall compute a derived magnitude value \(m = \sqrt{x^2 + y^2 + z^2}\) for each stored sample.
- **FR-5**: The backend shall store ingested sensor samples as time-series data keyed by `time` and `node_id`.
- **FR-6**: The backend shall associate ingested samples with a registered sensor node and reject ingestion for unregistered nodes.
- **FR-7**: The backend shall update the node’s `last_heartbeat` (or last activity timestamp) upon successful data ingestion.
- **FR-8**: The backend shall support query of recent sensor data by node and time window (e.g., last N minutes) with a configurable maximum limit.
- **FR-9**: The backend shall support query of sensor data by explicit time range (`start`/`end` or `start_time`/`end_time`) for historical retrieval.
- **FR-10**: The backend shall provide aggregated sensor statistics over selectable intervals (e.g., hourly aggregates).

### 4.2 Sensor Node Management

- **FR-11**: The system shall support registration of a sensor node with unique `node_id`, name, latitude, longitude, elevation (optional), status, and firmware version (optional).
- **FR-12**: The system shall record node status values including `active`, `inactive`, and `maintenance`.
- **FR-13**: The backend shall expose an endpoint for nodes to submit a heartbeat including `node_id`, optional status, battery level, and firmware version.
- **FR-14**: The backend shall expose an admin-restricted endpoint to list all sensor nodes with pagination and filtering by status.
- **FR-15**: The backend shall expose an admin-restricted endpoint to retrieve details for a specific sensor node by node identifier.
- **FR-16**: The backend shall allow admin users to update node metadata and deactivate nodes.

### 4.3 Event Detection and Management

- **FR-17**: The backend shall derive potential event detections using rule-based thresholds (e.g., STA/LTA and/or magnitude threshold) configurable via environment or configuration.
- **FR-18**: When a detection is triggered, the backend shall create a new event or associate the detection with an existing recent event in proximity (configurable radius and time window).
- **FR-19**: The backend shall store events with attributes including event type, confidence, detected timestamp, status, and optional location and magnitude estimate.
- **FR-20**: The backend shall store event detections linking events to nodes with detection time and peak metrics (e.g., peak acceleration, STA/LTA ratio).
- **FR-21**: The backend shall expose public endpoints to list events with pagination and filtering by time range, status, and event type.
- **FR-22**: The backend shall expose public endpoints to retrieve event details and associated detections.
- **FR-23**: The backend shall allow admin users to manually create events.
- **FR-24**: The backend shall allow admin users to update event status and metadata (e.g., confirm / mark false positive).
- **FR-25**: The backend shall allow admin users to delete events.
- **FR-26**: The backend shall provide event statistics endpoints for dashboards (e.g., totals, recent counts, status distribution).

### 4.4 Machine Learning Classification Workflow

- **FR-27**: The backend shall extract or assemble feature vectors from sensor data segments for ML classification.
- **FR-28**: The backend shall send feature data and relevant metadata to the ML service and receive a prediction label and confidence score.
- **FR-29**: The backend shall store ML predictions with start/end timestamps, model version, confidence, and features (as JSON where appropriate).
- **FR-30**: The backend shall incorporate ML classification results into event confidence and decision logic according to configured thresholds.
- **FR-31**: The system shall support disabling ML-based classification (fallback to rule-based detection) for maintenance or experimentation.
- **FR-32**: The system shall support historical re-classification of archived segments for evaluation and model improvement (admin-restricted).

### 4.5 Alerts and Notifications

- **FR-33**: The backend shall generate alerts when event detection thresholds and/or ML confidence thresholds are exceeded.
- **FR-34**: Alerts shall include event identifiers, time, location estimate (if available), confidence, and affected nodes.
- **FR-35**: The frontend shall display alerts in near real-time and allow filtering by severity/type/time.
- **FR-36**: The system shall support notification channels as configurable modules (e.g., in-app, email, SMS) and may implement only in-app alerts for thesis scope.

### 4.6 Crowd-Sourced “Felt It” Reporting

- **FR-37**: The system shall allow anonymous users to submit felt reports with latitude, longitude, intensity (1–10), optional description, and report timestamp.
- **FR-38**: The system shall allow authenticated users to submit felt reports linked to their user account.
- **FR-39**: The system shall allow felt reports to optionally reference an event (if an event is known).
- **FR-40**: The system shall expose public endpoints to retrieve recent felt reports and felt-report statistics.
- **FR-41**: The system shall expose public endpoints to retrieve felt reports near a location within a radius and time window.
- **FR-42**: The system shall expose an intensity scale reference endpoint for user guidance.
- **FR-43**: Admin users shall be able to delete inappropriate or fraudulent felt reports.

### 4.7 User Authentication and Authorization

- **FR-44**: The system shall support user registration with email and password (minimum complexity defined in validation rules) and optional display name.
- **FR-45**: The system shall support user login and issue an access token and refresh token.
- **FR-46**: The system shall support token refresh using a refresh token to obtain a new access token.
- **FR-47**: The system shall support user logout and invalidate refresh tokens (as implemented).
- **FR-48**: The system shall provide a protected endpoint to retrieve the current user profile.
- **FR-49**: The system shall provide a protected endpoint to update the current user profile.
- **FR-50**: The system shall provide a protected endpoint to change user password given the current password.
- **FR-51**: The system shall enforce role-based access control such that admin-only endpoints are inaccessible to non-admin users.

### 4.8 Admin Monitoring and Control

- **FR-52**: The system shall provide an admin dashboard endpoint summarizing sensor/node health, event counts, and reporting metrics.
- **FR-53**: The system shall provide admin endpoints for system statistics over a configurable time period.
- **FR-54**: The system shall provide admin endpoints to list, update, and deactivate users.
- **FR-55**: The system shall maintain an audit log of admin actions with timestamp, action type, resource identifiers, and metadata.
- **FR-56**: The system shall provide admin endpoints to query audit logs and recent activity.
- **FR-57**: The system shall provide admin endpoints to inspect database and TimescaleDB health (extension presence, hypertables, chunk info).
- **FR-58**: The system shall provide an admin endpoint to initiate cleanup/retention actions (e.g., delete old sensor data beyond retention).

---

## 5. Data Requirements

### 5.1 Data Entities (Conceptual)

The system shall manage, at minimum, the following conceptual entities:

- **SensorNode**: registration and status metadata.
- **SensorData**: time-series accelerometer readings and derived magnitude.
- **Event**: seismic event record (type, confidence, time, status, optional location).
- **EventDetection**: link between Event and SensorNode at detection time with metrics.
- **User**: authentication identity and role.
- **FeltReport**: crowdsourced perception report with location and intensity.
- **Prediction**: ML output stored with confidence, features, and time segment.
- **AdminLog**: audit trail for admin actions.

### 5.2 Time-Series Handling (TimescaleDB)

- **DR-1**: SensorData shall be stored in a TimescaleDB hypertable partitioned by time with a chunk interval suitable for expected ingestion rate (e.g., daily chunks).
- **DR-2**: SensorData shall support efficient queries for “recent N minutes” and bounded time-range retrieval.
- **DR-3**: The database shall support continuous aggregates (e.g., hourly aggregates per node) to accelerate dashboard views.
- **DR-4**: Primary key design shall ensure uniqueness of samples per `(time, node_id)` for idempotency and conflict control where applicable.

### 5.3 Data Quality and Validation

- **DR-5**: The system shall validate location fields (latitude, longitude) within valid ranges.
- **DR-6**: The system shall validate felt intensity values within defined bounds (1–10).
- **DR-7**: The system shall validate timestamps as ISO 8601 and store times in UTC.

### 5.4 Retention and Archiving

- **DR-8**: The system shall define a configurable retention policy for raw sensor data (e.g., 30/90/365 days) and support cleanup actions.
- **DR-9**: The system shall preserve higher-level aggregates, events, and felt reports beyond raw-data retention as configured.

---

## 6. Non-Functional Requirements

### 6.1 Performance and Latency

- **NFR-1**: The backend shall respond to ingestion requests within **≤ 500 ms** at the 95th percentile under nominal load (single node, local network), excluding network transmission delays.
- **NFR-2**: The system shall process and persist a single ingestion payload at a sustained throughput of **≥ 50 samples/sec per node** for at least **50 nodes** in a scalable deployment (target; thesis evaluation may use lower scale but architecture must support scaling).
- **NFR-3**: Dashboard retrieval endpoints (recent events, node lists, aggregates) shall respond within **≤ 1 s** at 95th percentile under nominal load.

### 6.2 Scalability

- **NFR-4**: The architecture shall support horizontal scaling of the backend API layer (stateless services behind a load balancer).
- **NFR-5**: The data layer shall support scaling via TimescaleDB features (chunking, indexing, continuous aggregates) and standard PostgreSQL tuning.

### 6.3 Reliability and Availability

- **NFR-6**: The system shall tolerate intermittent sensor connectivity and support resubmission via batch ingestion.
- **NFR-7**: The backend shall implement retry logic for database connection at startup and fail fast with clear logs if unavailable beyond configured retries.
- **NFR-8**: The system shall provide health endpoints for liveness checks and operational monitoring.

### 6.4 Security

- **NFR-9**: All privileged operations shall require authentication and authorization checks (role-based).
- **NFR-10**: Passwords shall be stored only as salted, one-way hashes using an industry-standard algorithm (e.g., bcrypt) with appropriate work factor.
- **NFR-11**: Access tokens shall be time-limited and transmitted only via HTTPS in production.
- **NFR-12**: The system shall implement rate limiting on public and device endpoints to mitigate abuse and denial-of-service attacks.
- **NFR-13**: The system shall sanitize and validate inputs to prevent injection attacks and shall use parameterized queries for database access.
- **NFR-14**: Audit logs shall be tamper-evident within system constraints (append-only semantics and restricted write access).

### 6.5 Usability and Accessibility

- **NFR-15**: The frontend shall present information clearly and consistently with minimal steps for key tasks (view nodes, view events, submit felt report).
- **NFR-16**: The frontend shall meet basic accessibility expectations (keyboard navigation, color contrast, readable typography) aligned with WCAG 2.1 AA where feasible.

### 6.6 Maintainability and Extensibility

- **NFR-17**: The system shall use modular service boundaries (sensor ingestion, events, felt reports, auth, admin) to enable future expansion.
- **NFR-18**: The system shall provide configuration via environment variables for deployment portability.
- **NFR-19**: The system shall log major operations and errors with sufficient context to support debugging and evaluation.

### 6.7 Portability and Deployment

- **NFR-20**: The system shall support containerized deployment for the database layer (Docker) and reproducible local setup.
- **NFR-21**: The system shall document setup steps for local development and testing, including database initialization and migrations.

---

## 7. System Models

### 7.1 Context Model (Textual)

**Actors**:

- Sensor Node → Backend: sends heartbeat and sensor data
- Backend → Database: stores/retrieves time-series and metadata
- Backend ↔ ML Service: sends features; receives predictions
- User/Admin → Frontend: interacts with dashboards/forms
- Frontend → Backend: fetches data and submits actions/reports

**System Boundary**:

The “Seismic Sensor Network System” includes sensor nodes, backend, database, ML service, and frontend. External systems may include internet infrastructure and optional notification services.

### 7.2 Use Case Model (Representative)

#### UC-1: Submit Sensor Data (Single Sample)

- **Primary Actor**: Sensor Node
- **Preconditions**: Node is registered and active; backend reachable.
- **Main Flow**:
  - Node sends POST `/api/sensors/data` with measurement payload.
  - Backend validates payload and node status.
  - Backend computes magnitude and stores in SensorData hypertable.
  - Backend updates node heartbeat.
  - Backend optionally triggers detection + ML classification.
  - Backend returns success response.
- **Postconditions**: Sample stored; node activity updated; optional detection/prediction stored.
- **Alternative Flows**:
  - Node not registered → 404 error.
  - Payload invalid → 422/400 validation error.

#### UC-2: View Recent Events

- **Primary Actor**: User (Anonymous or Registered)
- **Preconditions**: Backend reachable; events exist (optional).
- **Main Flow**:
  - Frontend calls GET `/api/events/recent`.
  - Backend retrieves recent events and returns list.
  - Frontend renders events timeline/list.

#### UC-3: Submit Felt Report

- **Primary Actor**: Anonymous User or Registered User
- **Preconditions**: Backend reachable; location accessible (manual or device).
- **Main Flow**:
  - User submits POST `/api/felt` with location, intensity, optional description, optional event link.
  - Backend validates and stores report.
  - Backend returns confirmation.

#### UC-4: Admin Registers Sensor Node

- **Primary Actor**: Admin User
- **Preconditions**: Admin authenticated.
- **Main Flow**:
  - Admin calls POST `/api/admin/nodes` with node metadata.
  - Backend validates uniqueness and stores node.
  - Backend logs admin action.
  - Backend returns created node details.

### 7.3 Workflow Model (Event Detection + ML)

1. Ingest sensor sample(s)
2. Fetch recent window for node
3. Compute STA/LTA or threshold heuristic
4. If triggered:
   - Extract features
   - Request ML classification
   - Store prediction
   - Create or update Event and add EventDetection
   - Generate alert for frontend

### 7.4 State Model (Sensor Node)

Nodes transition among:

- `inactive` → `active` (upon activation/registration and heartbeat)
- `active` → `maintenance` (admin action or device indicates maintenance)
- `maintenance` → `active` (admin/device indicates recovery)
- Any → `inactive` (deactivation or long heartbeat timeout policy, if implemented)

---

## 8. API and Interface Specifications (High-Level)

### 8.1 API Design Principles

- JSON request/response bodies
- Consistent envelope format:
  - `success: boolean`
  - `data: object` on success
  - `error: string` on failure
- Standard HTTP status codes (200/201/400/401/403/404/429/500)

### 8.2 Representative Endpoints (Informative)

The SRS specifies interface behaviors; concrete paths are informative:

- **Health**: `GET /health`
- **Auth**: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me`, `/api/auth/logout`
- **Sensors**: `/api/sensors/data`, `/api/sensors/data/batch`, `/api/sensors/heartbeat`, `/api/sensors/nodes`, `/api/sensors/data/:nodeId`
- **Events**: `/api/events`, `/api/events/recent`, `/api/events/:id`, `/api/events/:id/detections`
- **Felt**: `/api/felt`, `/api/felt/recent`, `/api/felt/nearby`, `/api/felt/intensity-scale`
- **Admin**: `/api/admin/dashboard`, `/api/admin/nodes`, `/api/admin/users`, `/api/admin/logs`, `/api/admin/database`

### 8.3 Sensor Payload Format (Informative)

**Single sample**:

- `node_id`: string
- `x`, `y`, `z`: number
- `sampling_rate`: integer (optional)
- `timestamp`: ISO 8601 (optional)

**Batch**:

- `node_id`: string
- `sampling_rate`: integer (optional)
- `data`: array of `{x,y,z,timestamp}`

### 8.4 Felt Report Payload Format (Informative)

- `latitude`, `longitude`: number
- `intensity`: integer 1–10
- `description`: string (optional)
- `reported_at`: ISO 8601 (optional; else server assigns)
- `event_id`: UUID (optional)
- `is_anonymous`: boolean (optional; default false)

---

## 9. Verification and Acceptance Criteria

### 9.1 Acceptance Criteria Format

Each acceptance criterion is testable and maps to one or more requirements.

### 9.2 Acceptance Criteria (Selected)

- **AC-1 (FR-1..FR-7)**: Given a registered active node, when a valid sensor sample is posted, then the API returns success and a corresponding record exists in the SensorData hypertable.
- **AC-2 (FR-2..FR-5)**: Given a valid batch payload, when batch ingestion is called, then the number of inserted rows equals the batch size and retrieval returns those samples within the requested range.
- **AC-3 (FR-11..FR-16)**: Given an admin token, when a node is created and listed, then the node appears with correct metadata and status transitions are reflected after updates.
- **AC-4 (FR-17..FR-25)**: Given detection triggers or manual creation, when events are created/updated, then event lists and event detail endpoints reflect accurate status and detections.
- **AC-5 (FR-27..FR-31)**: Given a triggered detection, when ML is enabled, then a prediction is stored with confidence and can be retrieved via admin/database insights or logs (as implemented).
- **AC-6 (FR-37..FR-43)**: Given a felt report submission, then it is stored and retrievable via recent/nearby endpoints; admin deletion removes it from public retrieval.
- **AC-7 (FR-44..FR-51)**: Given valid registration and login, then protected endpoints deny access without token and allow access with valid token; admin endpoints require admin role.
- **AC-8 (NFR-12)**: Given a request rate exceeding configured limits, then the API responds with 429 and a consistent error message.

---

## 10. Requirements Traceability (High-Level)

### 10.1 Traceability Matrix (Abbreviated)

| Requirement Group | Verification Method |
|---|---|
| Sensor ingestion (FR-1..FR-10) | API tests, DB inspection, performance sampling |
| Node management (FR-11..FR-16) | API tests, RBAC tests |
| Events (FR-17..FR-26) | API tests, DB inspection, synthetic triggers |
| ML workflow (FR-27..FR-32) | Integration tests with ML stub/service |
| Felt reports (FR-37..FR-43) | API tests, UI tests |
| Auth/RBAC (FR-44..FR-51) | Security tests, token expiry tests |
| NFRs | Load testing, security review, usability evaluation |

---

## 11. Appendices

### 11.1 Glossary (Expanded)

- **Continuous Aggregate**: Precomputed materialized view maintained by TimescaleDB for efficient aggregate queries.
- **Chunk**: Time-partitioned storage unit for hypertables.
- **Confidence Score**: Numeric probability-like measure from ML (0–1) indicating certainty.

### 11.2 Academic Notes

This SRS is intended to be used as the baseline requirements document for:

- System implementation planning and division of labor
- Experimental evaluation (latency/throughput, detection accuracy, usability)
- Traceable validation through Postman/API tests and controlled datasets


