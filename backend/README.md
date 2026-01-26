# Seismic Sensor Network Backend

A production-ready Node.js backend for ESP32-based seismic sensor networks with real-time earthquake detection, crowdsourced felt reports, and administrative monitoring.

## Features

- **Sensor Data Ingestion**: Receive and store accelerometer data from ESP32 nodes
- **Event Detection**: STA/LTA algorithm with ML placeholder for earthquake classification
- **Crowdsourced Reports**: "Felt-It" feature for user-submitted earthquake reports
- **Admin Dashboard**: Node management, system statistics, and audit logging
- **Time-Series Storage**: PostgreSQL with TimescaleDB for efficient sensor data storage

## Tech Stack

- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with TimescaleDB extension
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi
- **Security**: Helmet, bcrypt, rate limiting

## Prerequisites

- Node.js >= 18.0.0
- Docker and Docker Compose (for database setup)
- OR PostgreSQL >= 14.0 with TimescaleDB extension (for local installation)

## Installation

### Option 1: Using Docker (Recommended)

1. Clone the repository and navigate to backend:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp env.sample .env
   ```

4. Start PostgreSQL with TimescaleDB using Docker:
   ```bash
   docker-compose up -d
   ```

5. Wait for the database to be ready (about 10-15 seconds), then run migrations:
   ```bash
   npm run migrate
   ```

6. Start the server:
   ```bash
   npm run dev
   ```

**Docker Commands:**
- Start database: `docker-compose up -d`
- Stop database: `docker-compose down`
- View logs: `docker-compose logs -f postgres`
- Stop and remove volumes: `docker-compose down -v` (⚠️ deletes all data)

### Option 2: Local PostgreSQL Installation

1. Clone the repository and navigate to backend:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp env.sample .env
   ```

4. Edit `.env` with your database credentials and secrets.

5. Create the database:
   ```bash
   createdb seismic_db
   ```

6. Run migrations to set up TimescaleDB:
   ```bash
   npm run migrate
   ```

7. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Sensor Routes (`/api/sensors`)
- `POST /data` - Ingest accelerometer data
- `POST /heartbeat` - Node health check
- `GET /nodes` - List all sensor nodes (admin)
- `GET /nodes/:nodeId` - Get node details
- `GET /data/:nodeId` - Get recent data for a node

### Event Routes (`/api/events`)
- `GET /` - List events with pagination
- `GET /:id` - Get event details
- `GET /recent` - Get recent events (24h)

### Felt Routes (`/api/felt`)
- `POST /` - Submit felt report
- `GET /nearby` - Get reports near location
- `GET /event/:eventId` - Get reports for an event

### Auth Routes (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User/admin login
- `GET /me` - Get current user (protected)

### Admin Routes (`/api/admin`)
- `POST /nodes` - Register sensor node
- `PUT /nodes/:nodeId` - Update node
- `DELETE /nodes/:nodeId` - Deactivate node
- `GET /stats` - System statistics
- `GET /logs` - Audit logs
- `PUT /events/:eventId/status` - Update event status

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost (use `postgres` if connecting from Docker container) |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | seismic_db |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres (Docker default) |
| `JWT_SECRET` | JWT signing secret | - |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |

**Note:** When using Docker Compose, the default database password is `postgres`. Change it in `docker-compose.yml` and `.env` for production use.

## Project Structure

```
backend/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Server entry point
│   ├── config/             # Configuration files
│   ├── routes/             # API route definitions
│   ├── controllers/        # Business logic
│   ├── models/             # Database operations
│   ├── utils/              # Utility functions
│   └── middlewares/        # Express middlewares
├── migrations/             # Database migrations
└── package.json
```

## License

ISC

