# Postman Testing Guide - Seismic Sensor Backend

Complete step-by-step guide to test all API endpoints using Postman.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Postman Setup](#postman-setup)
3. [Testing Workflow](#testing-workflow)
4. [Authentication Endpoints](#1-authentication-endpoints)
5. [Sensor Data Endpoints](#2-sensor-data-endpoints)
6. [Event Endpoints](#3-event-endpoints)
7. [Felt Reports Endpoints](#4-felt-reports-endpoints)
8. [Admin Endpoints](#5-admin-endpoints)

---

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd backend
   npm run dev
   ```
   Server should be running on `http://localhost:3000`

2. **Database Running**
   ```bash
   docker-compose up -d
   ```

3. **Migrations Run**
   ```bash
   npm run migrate
   ```

---

## Postman Setup

### Step 1: Create Postman Environment

1. Open Postman
2. Click **Environments** (left sidebar) → **+** (Create Environment)
3. Name it: `Seismic Sensor Backend`
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` |
| `access_token` | (leave empty) | (will be set automatically) |
| `refresh_token` | (leave empty) | (will be set automatically) |
| `user_id` | (leave empty) | (will be set automatically) |
| `admin_token` | (leave empty) | (will be set automatically) |
| `node_id` | (leave empty) | (will be set automatically) |
| `event_id` | (leave empty) | (will be set automatically) |

5. Click **Save**
6. Select this environment from the dropdown (top right)

### Step 2: Create Collection

1. Click **Collections** → **+** (New Collection)
2. Name it: `Seismic Sensor API`
3. Right-click collection → **Edit**
4. Go to **Variables** tab
5. Add the same variables as above (optional, for collection-level variables)

---

## Testing Workflow

**Recommended Order:**
1. Health Check (verify server is running)
2. Register a regular user
3. Login as user
4. Register/Login as admin
5. Test sensor endpoints
6. Test event endpoints
7. Test felt report endpoints
8. Test admin endpoints

---

## 1. Authentication Endpoints

### 1.1 Health Check (No Auth Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/health`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Seismic Sensor Backend is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**✅ Action:** Verify server is running

---

### 1.2 Register User (No Auth Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/register`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "email": "testuser@example.com",
  "password": "TestPassword123!",
  "name": "Test User"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "name": "Test User",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt-token-here",
      "refreshToken": "refresh-token-here"
    }
  }
}
```

**✅ Actions:**
1. Copy `accessToken` → Set `{{access_token}}` variable
2. Copy `refreshToken` → Set `{{refresh_token}}` variable
3. Copy `user.id` → Set `{{user_id}}` variable

**How to set variables in Postman:**
- In **Tests** tab, add:
```javascript
if (pm.response.code === 201) {
    const jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.data.tokens.accessToken);
    pm.environment.set("refresh_token", jsonData.data.tokens.refreshToken);
    pm.environment.set("user_id", jsonData.data.user.id);
}
```

---

### 1.3 Login User (No Auth Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/login`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "email": "testuser@example.com",
  "password": "TestPassword123!"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "name": "Test User",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt-token-here",
      "refreshToken": "refresh-token-here"
    }
  }
}
```

**✅ Actions:**
- Same variable setting as registration
- Use this to refresh tokens if needed

---

### 1.4 Register Admin User (No Auth Required - First Time Only)

**Note:** You need to manually create an admin in the database first, or use the default admin from migrations.

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/register`
- **Body:**
```json
{
  "email": "admin@seismic.local",
  "password": "admin123",
  "name": "System Admin"
}
```

**Then manually update role in database, OR:**

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/login`
- **Body:**
```json
{
  "email": "admin@seismic.local",
  "password": "admin123"
}
```

**✅ Actions:**
- Copy admin `accessToken` → Set `{{admin_token}}` variable

---

### 1.5 Get Current User Profile (Auth Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/auth/me`
- **Headers:**
  - `Authorization: Bearer {{access_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "email": "testuser@example.com",
    "name": "Test User",
    "role": "user",
    "is_active": true,
    "last_login": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-15T10:00:00.000Z"
  }
}
```

**✅ Action:** Verify authentication is working

---

### 1.6 Update User Profile (Auth Required)

**Request:**
- **Method:** `PUT`
- **URL:** `{{base_url}}/api/auth/me`
- **Headers:**
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "name": "Updated Name"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid-here",
    "email": "testuser@example.com",
    "name": "Updated Name",
    "role": "user"
  }
}
```

---

### 1.7 Change Password (Auth Required)

**Request:**
- **Method:** `PUT`
- **URL:** `{{base_url}}/api/auth/password`
- **Headers:**
  - `Authorization: Bearer {{access_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "currentPassword": "TestPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 1.8 Refresh Token (No Auth Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/refresh`
- **Headers:**
  - `Content-Type: application/json`
- **Body:**
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token-here",
    "refreshToken": "new-refresh-token-here"
  }
}
```

**✅ Actions:**
- Update `{{access_token}}` and `{{refresh_token}}` variables

---

### 1.9 Logout (Auth Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/auth/logout`
- **Headers:**
  - `Authorization: Bearer {{access_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. Sensor Data Endpoints

### 2.1 Register Sensor Node (Admin Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/admin/nodes`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "node_id": "ESP32_NODE_001",
  "name": "Sensor Node 1",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "elevation": 50.5,
  "status": "active",
  "firmware_version": "1.0.0"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Sensor node registered successfully",
  "data": {
    "id": "uuid-here",
    "node_id": "ESP32_NODE_001",
    "name": "Sensor Node 1",
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "elevation": "50.5",
    "status": "active",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**✅ Actions:**
- Copy `node_id` → Set `{{node_id}}` variable
- Copy `id` (UUID) → Save for later use

**Tests Tab Script:**
```javascript
if (pm.response.code === 201) {
    const jsonData = pm.response.json();
    pm.environment.set("node_id", jsonData.data.node_id);
}
```

---

### 2.2 Send Sensor Heartbeat (Public - No Auth)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/sensors/heartbeat`
- **Headers:**
  - `Content-Type: application/json`
- **Body:**
```json
{
  "node_id": "{{node_id}}",
  "status": "active",
  "battery_level": 85,
  "firmware_version": "1.0.0"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "data": {
    "node_id": "ESP32_NODE_001",
    "last_heartbeat": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2.3 Ingest Single Sensor Data Point (Public - No Auth)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/sensors/data`
- **Headers:**
  - `Content-Type: application/json`
- **Body:**
```json
{
  "node_id": "{{node_id}}",
  "x": 0.123,
  "y": -0.456,
  "z": 0.789,
  "sampling_rate": 100,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Sensor data ingested successfully",
  "data": {
    "time": "2024-01-15T10:30:00.000Z",
    "node_id": "ESP32_NODE_001",
    "magnitude": 0.923
  }
}
```

**✅ Action:** Send multiple requests with different timestamps to create test data

---

### 2.4 Ingest Batch Sensor Data (Public - No Auth)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/sensors/data/batch`
- **Headers:**
  - `Content-Type: application/json`
- **Body:**
```json
{
  "node_id": "{{node_id}}",
  "sampling_rate": 100,
  "data": [
    {
      "x": 0.1,
      "y": 0.2,
      "z": 0.3,
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    {
      "x": 0.2,
      "y": 0.3,
      "z": 0.4,
      "timestamp": "2024-01-15T10:30:01.000Z"
    },
    {
      "x": 0.3,
      "y": 0.4,
      "z": 0.5,
      "timestamp": "2024-01-15T10:30:02.000Z"
    }
  ]
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Batch sensor data ingested successfully",
  "data": {
    "inserted": 3,
    "node_id": "ESP32_NODE_001"
  }
}
```

---

### 2.5 Get All Sensor Nodes (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/sensors/nodes`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "uuid-here",
        "node_id": "ESP32_NODE_001",
        "name": "Sensor Node 1",
        "latitude": "37.7749",
        "longitude": "-122.4194",
        "status": "active",
        "last_heartbeat": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

### 2.6 Get Specific Sensor Node (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/sensors/nodes/{{node_id}}`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "node_id": "ESP32_NODE_001",
    "name": "Sensor Node 1",
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "elevation": "50.5",
    "status": "active",
    "last_heartbeat": "2024-01-15T10:30:00.000Z",
    "battery_level": 85,
    "firmware_version": "1.0.0"
  }
}
```

---

### 2.7 Get Sensor Data for Node (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/sensors/data/{{node_id}}?start_time=2024-01-15T00:00:00Z&end_time=2024-01-15T23:59:59Z&limit=100`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Query Parameters:**
- `start_time` (optional): ISO 8601 timestamp
- `end_time` (optional): ISO 8601 timestamp
- `limit` (optional): Number of records (default: 100, max: 1000)

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "node_id": "ESP32_NODE_001",
    "data": [
      {
        "time": "2024-01-15T10:30:00.000Z",
        "x": "0.123",
        "y": "-0.456",
        "z": "0.789",
        "magnitude": "0.923"
      }
    ],
    "count": 1,
    "time_range": {
      "start": "2024-01-15T10:30:00.000Z",
      "end": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 2.8 Get Aggregated Sensor Data (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:**http://localhost:3000/api/sensors/data/ESP32_NODE_001/aggregates?hours=1
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Query Parameters:**
- `interval` (required): `1m`, `5m`, `15m`, `1h`, `1d`
- `start_time` (optional): ISO 8601 timestamp
- `end_time` (optional): ISO 8601 timestamp

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "node_id": "ESP32_NODE_001",
    "interval": "1h",
    "aggregates": [
      {
        "bucket": "2024-01-15T10:00:00.000Z",
        "avg_magnitude": "0.923",
        "max_magnitude": "1.234",
        "min_magnitude": "0.123",
        "sample_count": 3600
      }
    ]
  }
}
```

---

## 3. Event Endpoints

### 3.1 Get All Events (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/events?page=1&limit=20&status=confirmed&event_type=earthquake`
- **Headers:** None

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): `pending`, `confirmed`, `false_positive`
- `event_type` (optional): `earthquake`, `noise`, `unknown`
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date
- `min_confidence` (optional): 0.0 to 1.0

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid-here",
        "event_type": "earthquake",
        "confidence": 0.85,
        "magnitude_estimate": 4.5,
        "latitude": "37.7749",
        "longitude": "-122.4194",
        "detected_at": "2024-01-15T10:30:00.000Z",
        "status": "confirmed"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

**✅ Actions:**
- Copy an event `id` → Set `{{event_id}}` variable

---

### 3.2 Get Recent Events (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/events/recent`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "events": [...],
    "count": 5,
    "time_range": {
      "start": "2024-01-14T10:30:00.000Z",
      "end": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 3.3 Get Events Near Location (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/events/nearby?latitude=37.7749&longitude=-122.4194&radius_km=50&limit=10`
- **Headers:** None

**Query Parameters:**
- `latitude` (required): -90 to 90
- `longitude` (required): -180 to 180
- `radius_km` (optional): Distance in km (default: 50)
- `limit` (optional): Max results (default: 10)

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "events": [...],
    "center": {
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "radius_km": 50
  }
}
```

---

### 3.4 Get Event Statistics (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/events/stats`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_events": 150,
    "confirmed_earthquakes": 120,
    "pending": 20,
    "false_positives": 10,
    "last_24h": 5,
    "last_7d": 25,
    "last_30d": 100
  }
}
```

---

### 3.5 Get Specific Event (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/events/{{event_id}}`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "event_type": "earthquake",
    "confidence": 0.85,
    "magnitude_estimate": 4.5,
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "depth_km": 10.5,
    "detected_at": "2024-01-15T10:30:00.000Z",
    "status": "confirmed",
    "description": "Detected by 3 sensor nodes",
    "detections": [
      {
        "node_id": "ESP32_NODE_001",
        "peak_acceleration": 0.923,
        "distance_from_epicenter": 5.2
      }
    ]
  }
}
```

---

### 3.6 Get Event Detections (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/events/{{event_id}}/detections`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "event_id": "uuid-here",
    "detections": [
      {
        "id": "uuid-here",
        "node_id": "ESP32_NODE_001",
        "detection_time": "2024-01-15T10:30:00.000Z",
        "peak_acceleration": "0.923",
        "sta_lta_ratio": "3.5",
        "distance_from_epicenter": "5.2"
      }
    ],
    "count": 1
  }
}
```

---

### 3.7 Create Event (Admin Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/events`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "event_type": "earthquake",
  "confidence": 0.85,
  "magnitude_estimate": 4.5,
  "latitude": 37.7749,
  "longitude": -122.4194,
  "depth_km": 10.5,
  "detected_at": "2024-01-15T10:30:00.000Z",
  "status": "pending",
  "description": "Manually created test event"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": "uuid-here",
    "event_type": "earthquake",
    "detected_at": "2024-01-15T10:30:00.000Z",
    "status": "pending"
  }
}
```

**✅ Actions:**
- Copy `id` → Set `{{event_id}}` variable

---

### 3.8 Update Event Status (Admin Required)

**Request:**
- **Method:** `PUT`
- **URL:** `{{base_url}}/api/events/{{event_id}}/status`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "status": "confirmed",
  "event_type": "earthquake",
  "description": "Confirmed by multiple sensors"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Event status updated successfully",
  "data": {
    "id": "uuid-here",
    "status": "confirmed",
    "event_type": "earthquake"
  }
}
```

---

### 3.9 Delete Event (Admin Required)

**Request:**
- **Method:** `DELETE`
- **URL:** `{{base_url}}/api/events/{{event_id}}`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

## 4. Felt Reports Endpoints

### 4.1 Get Intensity Scale Reference (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/felt/intensity-scale`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "scale": "Modified Mercalli Intensity Scale",
    "levels": [
      {
        "level": 1,
        "description": "Not felt"
      },
      {
        "level": 2,
        "description": "Weak"
      }
      // ... more levels
    ]
  }
}
```

---

### 4.2 Submit Felt Report (Public - Optional Auth)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/felt`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{access_token}}` (optional)
- **Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "intensity": 5,
  "description": "Felt a moderate shaking",
  "event_id": "{{event_id}}",
  "is_anonymous": false
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Felt report submitted successfully",
  "data": {
    "id": "uuid-here",
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "intensity": 5,
    "reported_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 4.3 Get Recent Felt Reports (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/felt/recent?limit=20`
- **Headers:** None

**Query Parameters:**
- `limit` (optional): Number of reports (default: 20)

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "uuid-here",
        "latitude": "37.7749",
        "longitude": "-122.4194",
        "intensity": 5,
        "reported_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### 4.4 Get Felt Reports Near Location (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/felt/nearby?latitude=37.7749&longitude=-122.4194&radius_km=50&limit=20`
- **Headers:** None

**Query Parameters:**
- `latitude` (required): -90 to 90
- `longitude` (required): -180 to 180
- `radius_km` (optional): Distance in km (default: 50)
- `limit` (optional): Max results (default: 20)

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reports": [...],
    "center": {
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "radius_km": 50
  }
}
```

---

### 4.5 Get Felt Report Statistics (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/felt/stats`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_reports": 500,
    "last_24h": 10,
    "last_7d": 50,
    "last_30d": 200,
    "average_intensity": 4.2,
    "max_intensity": 8
  }
}
```

---

### 4.6 Get Felt Reports for Event (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/felt/event/{{event_id}}`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "event_id": "uuid-here",
    "reports": [
      {
        "id": "uuid-here",
        "latitude": "37.7749",
        "longitude": "-122.4194",
        "intensity": 5,
        "reported_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "count": 1,
    "average_intensity": 5.0
  }
}
```

---

### 4.7 Get Specific Felt Report (Public - No Auth)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/felt/{report_id}`
- **Headers:** None

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "intensity": 5,
    "description": "Felt a moderate shaking",
    "reported_at": "2024-01-15T10:30:00.000Z",
    "is_anonymous": false
  }
}
```

---

### 4.8 Delete Felt Report (Admin Required)

**Request:**
- **Method:** `DELETE`
- **URL:** `{{base_url}}/api/felt/{report_id}`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Felt report deleted successfully"
}
```

---

## 5. Admin Endpoints

**All admin endpoints require:**
- `Authorization: Bearer {{admin_token}}` header

### 5.1 Get Admin Dashboard (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/admin/dashboard`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_nodes": 10,
      "active_nodes": 8,
      "total_events": 150,
      "pending_events": 5,
      "total_reports": 500
    },
    "recent_activity": [...],
    "system_health": {
      "database_status": "healthy",
      "timescaledb_status": "active"
    }
  }
}
```

---

### 5.2 Get System Statistics (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/admin/stats?period=7d`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Query Parameters:**
- `period` (optional): `24h`, `7d`, `30d`, `all` (default: `7d`)

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "sensor_data": {
      "total_points": 1000000,
      "data_points_per_hour": 10000
    },
    "events": {
      "total": 25,
      "confirmed": 20,
      "pending": 5
    },
    "users": {
      "total": 100,
      "active": 80
    }
  }
}
```

---

### 5.3 Get All Users (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/admin/users?page=1&limit=20`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-here",
        "email": "user@example.com",
        "name": "User Name",
        "role": "user",
        "is_active": true,
        "created_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

---

### 5.4 Update User (Admin Required)

**Request:**
- **Method:** `PUT`
- **URL:** `{{base_url}}/api/admin/users/{{user_id}}`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "role": "admin",
  "is_active": true
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "uuid-here",
    "role": "admin",
    "is_active": true
  }
}
```

---

### 5.5 Deactivate User (Admin Required)

**Request:**
- **Method:** `DELETE`
- **URL:** `{{base_url}}/api/admin/users/{{user_id}}`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

---

### 5.6 Get Audit Logs (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/admin/logs?page=1&limit=50`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid-here",
        "admin_id": "uuid-here",
        "action": "update_user",
        "resource_type": "user",
        "resource_id": "uuid-here",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 200,
      "pages": 4
    }
  }
}
```

---

### 5.7 Get Recent Activity (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/admin/logs/recent`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "activity": [...],
    "count": 10
  }
}
```

---

### 5.8 Get Database Info (Admin Required)

**Request:**
- **Method:** `GET`
- **URL:** `{{base_url}}/api/admin/database`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "database": {
      "name": "seismic_db",
      "version": "PostgreSQL 16.0"
    },
    "timescaledb": {
      "version": "2.24.0",
      "hypertables": [
        {
          "name": "sensor_data",
          "chunks": 5,
          "compression_enabled": false
        }
      ]
    }
  }
}
```

---

### 5.9 Cleanup Old Data (Admin Required)

**Request:**
- **Method:** `POST`
- **URL:** `{{base_url}}/api/admin/cleanup`
- **Headers:**
  - `Authorization: Bearer {{admin_token}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "older_than_days": 90,
  "tables": ["sensor_data", "admin_logs"]
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Cleanup completed",
  "data": {
    "deleted_records": 10000,
    "tables_cleaned": ["sensor_data", "admin_logs"]
  }
}
```

---

## 🎯 Quick Testing Checklist

### Phase 1: Setup & Authentication
- [ ] Health check
- [ ] Register user
- [ ] Login user
- [ ] Get user profile
- [ ] Login as admin
- [ ] Refresh token

### Phase 2: Sensor Data
- [ ] Register sensor node (admin)
- [ ] Send heartbeat
- [ ] Ingest single data point
- [ ] Ingest batch data
- [ ] Get sensor nodes (admin)
- [ ] Get sensor data (admin)
- [ ] Get aggregates (admin)

### Phase 3: Events
- [ ] Get all events
- [ ] Get recent events
- [ ] Get events near location
- [ ] Get event statistics
- [ ] Create event (admin)
- [ ] Get specific event
- [ ] Update event status (admin)

### Phase 4: Felt Reports
- [ ] Get intensity scale
- [ ] Submit felt report
- [ ] Get recent reports
- [ ] Get reports near location
- [ ] Get report statistics
- [ ] Get reports for event

### Phase 5: Admin
- [ ] Get dashboard
- [ ] Get system stats
- [ ] Get all users
- [ ] Update user
- [ ] Get audit logs
- [ ] Get database info

---

## 🔧 Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check if token is set in environment variable
   - Verify token hasn't expired
   - Use refresh token endpoint

2. **403 Forbidden**
   - Verify you're using admin token for admin endpoints
   - Check user role in database

3. **404 Not Found**
   - Verify base URL is correct
   - Check endpoint path spelling
   - Ensure server is running

4. **422 Validation Error**
   - Check request body format
   - Verify required fields are present
   - Check data types match schema

5. **500 Server Error**
   - Check server logs
   - Verify database connection
   - Check TimescaleDB is initialized

---

## 📝 Notes

- All timestamps should be in ISO 8601 format: `2024-01-15T10:30:00.000Z`
- UUIDs are in format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Rate limiting: 100 requests per 15 minutes per IP
- Sensor data endpoints have special rate limiting for ESP32 nodes
- Use environment variables in Postman to avoid hardcoding values

---

**Happy Testing! 🚀**

