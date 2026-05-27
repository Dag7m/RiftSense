-- Add user locations + notifications for geo alerts
-- Safe to run multiple times (IF NOT EXISTS guards where possible)

-- 1) User locations (separate from users table)
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    -- Optional per-user preferred radius; if null, we use magnitude-based radius only
    radius_km DECIMAL(10, 2),
    notifications_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location ON user_locations(latitude, longitude);

-- 2) Notifications (stored alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'earthquake_alert',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    magnitude_estimate DECIMAL(4, 2),
    alert_radius_km DECIMAL(10, 2),
    distance_km DECIMAL(10, 2),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent spamming the same user for the same event
DO $$ BEGIN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_user_event_type_unique
      UNIQUE (user_id, event_id, type);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);

