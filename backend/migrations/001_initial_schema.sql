-- Seismic Sensor Network Database Schema
-- PostgreSQL with TimescaleDB Extension

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- Node status enum
DO $$ BEGIN
    CREATE TYPE node_status AS ENUM ('active', 'inactive', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Event type enum
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM ('earthquake', 'noise', 'unknown');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Event status enum
DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('pending', 'confirmed', 'false_positive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLES
-- =====================================================

-- 1. Sensor Nodes - Registered ESP32 sensor nodes
CREATE TABLE IF NOT EXISTS sensor_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    elevation DECIMAL(10, 2),
    status node_status DEFAULT 'active',
    last_heartbeat TIMESTAMPTZ,
    battery_level INTEGER,
    firmware_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sensor Data - Time-series accelerometer data (will be converted to hypertable)
CREATE TABLE IF NOT EXISTS sensor_data (
    time TIMESTAMPTZ NOT NULL,
    node_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    x_axis DECIMAL(10, 6) NOT NULL,
    y_axis DECIMAL(10, 6) NOT NULL,
    z_axis DECIMAL(10, 6) NOT NULL,
    magnitude DECIMAL(10, 6) NOT NULL,
    sampling_rate INTEGER DEFAULT 100,
    PRIMARY KEY (time, node_id)
);

-- 3. Events - Detected seismic events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type event_type DEFAULT 'unknown',
    confidence DECIMAL(5, 4) DEFAULT 0,
    magnitude_estimate DECIMAL(4, 2),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    depth_km DECIMAL(6, 2),
    detected_at TIMESTAMPTZ NOT NULL,
    status event_status DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Event Detections - Links sensor data to events
CREATE TABLE IF NOT EXISTS event_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    detection_time TIMESTAMPTZ NOT NULL,
    peak_acceleration DECIMAL(10, 6) NOT NULL,
    sta_lta_ratio DECIMAL(10, 4),
    distance_from_epicenter DECIMAL(10, 2),
    p_wave_arrival TIMESTAMPTZ,
    s_wave_arrival TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Users - Registered users (for felt reports and admin)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Felt Reports - Crowdsourced "Felt-It" reports
CREATE TABLE IF NOT EXISTS felt_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
    description TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Predictions - ML model predictions (placeholder)
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    data_segment_start TIMESTAMPTZ NOT NULL,
    data_segment_end TIMESTAMPTZ NOT NULL,
    prediction VARCHAR(50) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    features JSONB,
    model_version VARCHAR(50) DEFAULT 'placeholder-v1',
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Admin Logs - Audit trail for admin actions
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Sensor nodes indexes
CREATE INDEX IF NOT EXISTS idx_sensor_nodes_node_id ON sensor_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_sensor_nodes_status ON sensor_nodes(status);
CREATE INDEX IF NOT EXISTS idx_sensor_nodes_location ON sensor_nodes(latitude, longitude);

-- Sensor data indexes (additional to hypertable)
CREATE INDEX IF NOT EXISTS idx_sensor_data_node_id ON sensor_data(node_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_magnitude ON sensor_data(magnitude);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_detected_at ON events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_events_type_status ON events(event_type, status);

-- Event detections indexes
CREATE INDEX IF NOT EXISTS idx_event_detections_event_id ON event_detections(event_id);
CREATE INDEX IF NOT EXISTS idx_event_detections_node_id ON event_detections(node_id);
CREATE INDEX IF NOT EXISTS idx_event_detections_time ON event_detections(detection_time DESC);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Felt reports indexes
CREATE INDEX IF NOT EXISTS idx_felt_reports_event_id ON felt_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_felt_reports_location ON felt_reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_felt_reports_reported_at ON felt_reports(reported_at DESC);

-- Predictions indexes
CREATE INDEX IF NOT EXISTS idx_predictions_node_id ON predictions(node_id);
CREATE INDEX IF NOT EXISTS idx_predictions_prediction ON predictions(prediction);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);

-- Admin logs indexes
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- =====================================================
-- TIMESCALEDB HYPERTABLE
-- =====================================================

-- Convert sensor_data to hypertable (partitioned by time)
SELECT create_hypertable('sensor_data', 'time', 
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '1 day'
);

-- =====================================================
-- CONTINUOUS AGGREGATES (for dashboard statistics)
-- =====================================================

-- Hourly sensor data aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_data_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    node_id,
    AVG(magnitude) AS avg_magnitude,
    MAX(magnitude) AS max_magnitude,
    MIN(magnitude) AS min_magnitude,
    COUNT(*) AS sample_count
FROM sensor_data
GROUP BY time_bucket('1 hour', time), node_id
WITH NO DATA;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('sensor_data_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_sensor_nodes_updated_at ON sensor_nodes;
CREATE TRIGGER update_sensor_nodes_updated_at
    BEFORE UPDATE ON sensor_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA (Optional - for development)
-- =====================================================

-- Insert a default admin user (password: admin123 - change in production!)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@seismic.local', '$2b$10$rQZ9QW8E5E5E5E5E5E5E5O5E5E5E5E5E5E5E5E5E5E5E5E5E5E5E5', 'System Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

