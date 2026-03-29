-- 1. Safe Rest
DROP SCHEMA IF EXISTS flood_system CASCADE;
DROP TYPE IF EXISTS flood_severity CASCADE;
DROP TYPE IF EXISTS report_type CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS road_condition CASCADE;
DROP TYPE IF EXISTS dam_gate_status CASCADE;
DROP TYPE IF EXISTS route_type CASCADE;
DROP TYPE IF EXISTS alert_type CASCADE;
DROP TYPE IF EXISTS delivery_channel CASCADE;
DROP TYPE IF EXISTS delivery_status CASCADE;

-- 2. extensions and schema
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS flood_system;
SET search_path TO flood_system, public;

-- 3. enums
CREATE TYPE flood_severity AS ENUM ('NORMAL', 'WATCH', 'WARNING', 'EXTREME');
CREATE TYPE report_type AS ENUM (
    'FLOODED_ROAD',
    'DAMAGED_BRIDGE',
    'BLOCKED_ROAD'
);
CREATE TYPE report_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ARCHIVED'
);
CREATE TYPE user_role AS ENUM (
    'PUBLIC',
    'RESCUE',
    'AUTHORITY',
    'ADMIN'
);
CREATE TYPE road_condition AS ENUM (
    'PASSABLE',
    'HIGH_RISK',
    'BLOCKED'
);
CREATE TYPE dam_gate_status AS ENUM (
    'CLOSED',
    'PARTIALLY_OPEN',
    'OPEN',
    'EMERGENCY_OPEN'
);
CREATE TYPE route_type AS ENUM (
    'SAFEST',
    'TIME_OPTIMIZED'
);
CREATE TYPE alert_type AS ENUM (
    'DAM_RELEASE',
    'FLOOD_WARNING',
    'EVACUATION_ORDER'
);
CREATE TYPE delivery_channel AS ENUM (
    'PUSH_NOTIFICATION',
    'SMS',
    'IN_APP'
);
CREATE TYPE delivery_status AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);

-- 4. tables
CREATE TABLE flood_system.users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(150),
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'PUBLIC',
    last_known_location GEOMETRY(Point, 4326),
   -- phone format validation — rejects non-numeric or badly formatted numbers
    phone_number        VARCHAR(20) CHECK (phone_number ~ '^\+?[0-9\s\-]{7,20}$'),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_role     ON flood_system.users(role);
CREATE INDEX idx_users_email    ON flood_system.users(email);
CREATE INDEX idx_users_location ON flood_system.users USING GIST(last_known_location);

CREATE TABLE flood_system.flood_risk_zones (
    zone_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gauge_id        VARCHAR(100),
    zone_name       VARCHAR(200),
    description     TEXT,
    severity        flood_severity NOT NULL,
    confidence_score NUMERIC(4,3) DEFAULT 0.6 NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    -- Call ST_AsGeoJSON(geometry) in flood_zone_repository.go to get boundary as parseable GeoJSON
    geometry        GEOMETRY(Polygon, 4326) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    data_source     VARCHAR(100),
    expires_at      TIMESTAMPTZ,
    version         INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      UUID REFERENCES flood_system.users(user_id) ON DELETE SET NULL
);
CREATE INDEX idx_flood_zones_geometry ON flood_system.flood_risk_zones USING GIST(geometry);
CREATE INDEX idx_flood_zones_active   ON flood_system.flood_risk_zones(is_active);
CREATE INDEX idx_flood_zones_severity ON flood_system.flood_risk_zones(severity);
CREATE INDEX idx_flood_zones_gauge    ON flood_system.flood_risk_zones(gauge_id);
CREATE TABLE flood_system.road_segments (
    segment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    road_name       VARCHAR(200),
    osm_id          BIGINT UNIQUE,
    geometry        GEOMETRY(LineString, 4326) NOT NULL,
    -- Use ST_X(start_point) and ST_Y(start_point) to extract lng/lat in road_repository.go
    start_point     GEOMETRY(Point, 4326),
    end_point       GEOMETRY(Point, 4326),
    length_meters   NUMERIC(10,2),
    road_type       VARCHAR(50),
    is_one_way      BOOLEAN DEFAULT FALSE,
    condition       road_condition DEFAULT 'PASSABLE',
    flood_risk      NUMERIC(10,4) DEFAULT 0.0,
    hazard_score    NUMERIC(10,4) DEFAULT 0.0,
    risk_weight     NUMERIC(10,4) DEFAULT 1.0,
    last_updated    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roads_geometry   ON flood_system.road_segments USING GIST(geometry);
CREATE INDEX idx_roads_start      ON flood_system.road_segments USING GIST(start_point);
CREATE INDEX idx_roads_end        ON flood_system.road_segments USING GIST(end_point);
CREATE INDEX idx_roads_condition  ON flood_system.road_segments(condition);
-- partial index for PASSABLE roads
-- road_repository.go always filters WHERE condition = 'PASSABLE'
-- faster than a full index because it only indexes rows that actually get queried
CREATE INDEX idx_roads_passable  ON flood_system.road_segments(segment_id)
    WHERE condition = 'PASSABLE';

CREATE TABLE flood_system.hazard_reports (
    report_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES flood_system.users(user_id) ON DELETE CASCADE,
    report_type     report_type NOT NULL,
    status          report_status NOT NULL DEFAULT 'PENDING',
    location        GEOMETRY(Point, 4326) NOT NULL,
    affected_area   GEOMETRY(Polygon, 4326),
    -- severity is int (1-5) not an enum — matches Go service validation: if severity < 1 || severity > 5
    severity        SMALLINT NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
    description     TEXT,
    photo_urls      TEXT[],
    ttl             INTERVAL DEFAULT '3 hours',
    -- expires_at = submitted_at + ttl. Originally GENERATED ALWAYS AS but changed to trigger
    -- because PostgreSQL ERROR 42P17: generation expression must be immutable
    expires_at      TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by     UUID REFERENCES flood_system.users(user_id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    sensor_validated BOOLEAN DEFAULT FALSE,
    confidence_score NUMERIC(4,3) DEFAULT 0.5 NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0)
);
CREATE INDEX idx_reports_location ON flood_system.hazard_reports USING GIST(location);
CREATE INDEX idx_reports_status   ON flood_system.hazard_reports(status);
CREATE INDEX idx_reports_reporter ON flood_system.hazard_reports(reporter_id);
CREATE INDEX idx_reports_expires  ON flood_system.hazard_reports(expires_at);

-- partial index for PENDING reports
-- admin dashboard only queries PENDING reports — avoids scanning APPROVED/REJECTED/ARCHIVED rows
CREATE INDEX idx_reports_pending  ON flood_system.hazard_reports(submitted_at)
    WHERE status = 'PENDING';

CREATE TABLE flood_system.dam_stations (
    station_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_name    VARCHAR(200) NOT NULL,
    river_name      VARCHAR(100),
    location        GEOMETRY(Point, 4326) NOT NULL,
    current_water_level NUMERIC(8,3),
    max_capacity_m3     NUMERIC(15,2),
    alert_level_m       NUMERIC(8,3),
    minor_flood_level_m NUMERIC(8,3),
    major_flood_level_m NUMERIC(8,3),
    -- threshold ordering constraint
    -- prevents bad data where minor flood level is set higher than major flood level
    CONSTRAINT chk_flood_levels CHECK (
        alert_level_m < minor_flood_level_m
        AND minor_flood_level_m < major_flood_level_m
    ),
    gate_status     dam_gate_status DEFAULT 'CLOSED',
    discharge_rate_m3s  NUMERIC(10,3),
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_dams_location ON flood_system.dam_stations USING GIST(location);
CREATE TABLE flood_system.weather_data (
    weather_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coverage_area   GEOMETRY(Polygon, 4326),
    station_location GEOMETRY(Point, 4326),
    station_name    VARCHAR(100),
    rainfall_mm         NUMERIC(8,2),
    wind_speed_kmh      NUMERIC(6,2),
    humidity_percent    NUMERIC(5,2) CHECK (humidity_percent BETWEEN 0 AND 100),
    temperature_celsius NUMERIC(5,2),
    forecast_time   TIMESTAMPTZ NOT NULL,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_weather_area ON flood_system.weather_data USING GIST(coverage_area);
CREATE INDEX idx_weather_time ON flood_system.weather_data(forecast_time);

CREATE TABLE flood_system.shelters (
    shelter_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    shelter_type    VARCHAR(100),
    location        GEOMETRY(Point, 4326) NOT NULL,
    address         TEXT,
    capacity        INTEGER,
    current_occupancy INTEGER DEFAULT 0 CHECK (current_occupancy >= 0 AND (capacity IS NULL OR current_occupancy <= capacity)),
    contact_phone   VARCHAR(20),
    managed_by      VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    has_medical     BOOLEAN DEFAULT FALSE,
    has_food        BOOLEAN DEFAULT FALSE,
    has_water       BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_shelters_location ON flood_system.shelters USING GIST(location);

CREATE TABLE flood_system.alerts (
    alert_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(300) NOT NULL,
    message         TEXT NOT NULL,
    severity        flood_severity NOT NULL,
    alert_type      alert_type NOT NULL,
    target_area     GEOMETRY(Polygon, 4326) NOT NULL,
    published_by    UUID NOT NULL REFERENCES flood_system.users(user_id) ON DELETE CASCADE,
    published_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    related_dam_id  UUID REFERENCES flood_system.dam_stations(station_id)
);

CREATE INDEX idx_alerts_area   ON flood_system.alerts USING GIST(target_area);
CREATE INDEX idx_alerts_active ON flood_system.alerts(is_active, published_at DESC);

CREATE TABLE flood_system.alert_deliveries (
    delivery_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES flood_system.alerts(alert_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES flood_system.users(user_id) ON DELETE CASCADE,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    channel         delivery_channel NOT NULL,
    delivery_status delivery_status DEFAULT 'PENDING'::delivery_status NOT NULL,
    UNIQUE(alert_id, user_id)
);

CREATE INDEX idx_deliveries_user  ON flood_system.alert_deliveries(user_id);
CREATE INDEX idx_deliveries_alert ON flood_system.alert_deliveries(alert_id);
CREATE TABLE flood_system.route_plans (
    route_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES flood_system.users(user_id) ON DELETE CASCADE,
    start_node_id   VARCHAR(100) NOT NULL,
    end_node_id     VARCHAR(100) NOT NULL,
    start_point     GEOMETRY(Point, 4326),
    end_point       GEOMETRY(Point, 4326),
    route_geometry  GEOMETRY(LineString, 4326),
    -- path_nodes matches Go's RouteResult.Path []string — ordered node IDs from A* algorithm
    path_nodes      TEXT[],
    total_cost      NUMERIC(10,4),
    risk_score      NUMERIC(5,2),
    route_type      route_type DEFAULT 'SAFEST',
    distance_meters NUMERIC(10,2),
    estimated_minutes NUMERIC(8,2),
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes'),
    is_valid        BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_routes_user     ON flood_system.route_plans(user_id);
CREATE INDEX idx_routes_geometry ON flood_system.route_plans USING GIST(route_geometry);

CREATE TABLE flood_system.audit_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type     VARCHAR(100) NOT NULL,
    performed_by    UUID REFERENCES flood_system.users(user_id) ON DELETE SET NULL,
    target_table    VARCHAR(100),
    target_id       UUID,
    old_data        JSONB,
    new_data        JSONB,
    performed_at    TIMESTAMPTZ DEFAULT NOW(),
    notes           TEXT
);
CREATE INDEX idx_audit_performed_by ON flood_system.audit_log(performed_by);
CREATE INDEX idx_audit_performed_at ON flood_system.audit_log(performed_at DESC);
CREATE INDEX idx_audit_target       ON flood_system.audit_log(target_table, target_id);

CREATE TABLE flood_system.cache_snapshots (
    snapshot_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bounding_box    GEOMETRY(Polygon, 4326) NOT NULL,
    snapshot_data   JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
    is_valid        BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_cache_bbox  ON flood_system.cache_snapshots USING GIST(bounding_box);
CREATE INDEX idx_cache_valid ON flood_system.cache_snapshots(is_valid, expires_at);

-- 5. triggers and functions
CREATE OR REPLACE FUNCTION flood_system.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON flood_system.users
    FOR EACH ROW EXECUTE FUNCTION flood_system.update_updated_at_column();

CREATE TRIGGER trigger_zones_updated_at
    BEFORE UPDATE ON flood_system.flood_risk_zones
    FOR EACH ROW EXECUTE FUNCTION flood_system.update_updated_at_column();

-- Computes expires_at = submitted_at + ttl on every insert/update
CREATE OR REPLACE FUNCTION flood_system.set_report_expiry()
RETURNS TRIGGER AS $$
BEGIN
    NEW.expires_at := NEW.submitted_at + NEW.ttl;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_report_expiry
    BEFORE INSERT OR UPDATE OF ttl, submitted_at
    ON flood_system.hazard_reports
    FOR EACH ROW EXECUTE FUNCTION flood_system.set_report_expiry();

-- zone version auto-increment trigger
-- version increments on every update so the backend can detect concurrent changes
CREATE OR REPLACE FUNCTION flood_system.increment_zone_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_zone_version
    BEFORE UPDATE ON flood_system.flood_risk_zones
    FOR EACH ROW EXECUTE FUNCTION flood_system.increment_zone_version();

-- 6. maintainance function
CREATE OR REPLACE FUNCTION flood_system.archive_expired_reports()
RETURNS void AS $$
BEGIN
    UPDATE flood_system.hazard_reports
    SET status = 'ARCHIVED'
    WHERE status = 'APPROVED'
      AND expires_at < NOW();
    UPDATE flood_system.flood_risk_zones
    SET is_active = FALSE
    WHERE is_active = TRUE
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
    UPDATE flood_system.alerts
    SET is_active = FALSE
    WHERE is_active = TRUE
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
    -- expired row cleanup
    -- routes expire in 15 min, cache in 5 min — without this they pile up indefinitely
    DELETE FROM flood_system.route_plans
    WHERE expires_at < NOW();
    DELETE FROM flood_system.cache_snapshots
    WHERE expires_at < NOW();
   
END;
$$ LANGUAGE plpgsql;

-- 7. views
CREATE VIEW flood_system.active_flood_zones AS
    SELECT
        zone_id,
        gauge_id,
        zone_name,
        severity,
        confidence_score,
        geometry,
        data_source,
        expires_at
    FROM flood_system.flood_risk_zones
    WHERE is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());

CREATE VIEW flood_system.pending_reports_for_review AS
    SELECT
        r.report_id,
        r.report_type,
        r.severity,
        r.description,
        r.location,
        r.photo_urls,
        r.submitted_at,
        u.email AS reporter_email,
        u.full_name AS reporter_name
    FROM flood_system.hazard_reports r
    JOIN flood_system.users u ON r.reporter_id = u.user_id
    WHERE r.status = 'PENDING'
    ORDER BY r.submitted_at ASC;

CREATE VIEW flood_system.available_shelters AS
    SELECT
        shelter_id,
        name,
        shelter_type,
        location,
        capacity,
        current_occupancy,
        (capacity - current_occupancy) AS available_spaces,
        has_medical,
        has_food,
        has_water
    FROM flood_system.shelters
    WHERE is_active = TRUE
      AND (current_occupancy < capacity OR capacity IS NULL);

-- 8. row-level security 
-- all rows in all tables via the auto-generated REST API.

ALTER TABLE flood_system.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON flood_system.users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY users_select_admin ON flood_system.users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM flood_system.users
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

ALTER TABLE flood_system.hazard_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_any ON flood_system.hazard_reports
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY reports_select_own ON flood_system.hazard_reports
    FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY reports_admin ON flood_system.hazard_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM flood_system.users
            WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AUTHORITY')
        )
    );

ALTER TABLE flood_system.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_select_all ON flood_system.alerts
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY alerts_admin ON flood_system.alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM flood_system.users
            WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AUTHORITY')
        )
    );

ALTER TABLE flood_system.alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY deliveries_select_own ON flood_system.alert_deliveries
    FOR SELECT USING (user_id = auth.uid());

REVOKE SELECT (password_hash) ON flood_system.users FROM anon, authenticated;

-- 9. seed data
INSERT INTO flood_system.users (email, full_name, password_hash, role)
VALUES
    ('admin@flood.lk',   'Admin User',     '$2a$10$DSSIDEPdBJKXTmNXjBMwNeChV71TVpAQevHcqtf3t/riPFDLj9nZG',   'ADMIN'::user_role),
    ('evacuee@flood.lk', 'Test Evacuee',   '$2b$10$placeholder_hash_user',    'PUBLIC'::user_role),
    ('rescue@flood.lk',  'Rescue Officer', '$2b$10$placeholder_hash_rescue',  'RESCUE'::user_role);
INSERT INTO flood_system.flood_risk_zones (
    gauge_id, zone_name, severity, confidence_score, geometry, data_source, is_active
)
VALUES (
    'GAUGE-KELANI-001',
    'Kelani River Lower Basin',
    'WARNING'::flood_severity,
    0.85,
    ST_GeomFromText(
        'POLYGON((79.98 6.95, 80.05 6.95, 80.05 7.02, 79.98 7.02, 79.98 6.95))',
        4326
    ),
    'DMC Official',
    TRUE
);
INSERT INTO flood_system.shelters (
    name, shelter_type, location, capacity, has_medical, has_food, has_water
)
VALUES (
    'Kelaniya University Safe Zone',
    'university',
    ST_SetSRID(ST_MakePoint(79.9208, 7.0008), 4326),
    500,
    TRUE,
    TRUE,
    TRUE
);

-- alert_level_m must be < minor_flood_level_m < major_flood_level_m (enforced by CHECK)
INSERT INTO flood_system.dam_stations (
    station_name, river_name, location, alert_level_m, minor_flood_level_m, major_flood_level_m, gate_status
)
VALUES (
    'Rajanganaya Dam',
    'Malwathu Oya',
    ST_SetSRID(ST_MakePoint(80.3972, 8.3881), 4326),
    12.5,
    15.0,
    18.0,
    'CLOSED'::dam_gate_status
);

-- A-B-C-D mock road graph matching routing_service.go
-- ST_MakePoint takes (lng, lat) — longitude first
INSERT INTO flood_system.road_segments (road_name, start_point, end_point, geometry, condition, flood_risk, hazard_score, risk_weight)
VALUES
    ('A-B', ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326), ST_SetSRID(ST_MakePoint(79.8502, 6.9376), 4326),
     ST_MakeLine(ST_MakePoint(79.8612, 6.9271), ST_MakePoint(79.8502, 6.9376)), 'PASSABLE', 0.1, 0.1, 1.5),
    ('A-C', ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326), ST_SetSRID(ST_MakePoint(79.8700, 6.9401), 4326),
     ST_MakeLine(ST_MakePoint(79.8612, 6.9271), ST_MakePoint(79.8700, 6.9401)), 'PASSABLE', 0.2, 0.2, 3.0),
    ('B-D', ST_SetSRID(ST_MakePoint(79.8502, 6.9376), 4326), ST_SetSRID(ST_MakePoint(79.8550, 6.9450), 4326),
     ST_MakeLine(ST_MakePoint(79.8502, 6.9376), ST_MakePoint(79.8550, 6.9450)), 'PASSABLE', 0.1, 0.1, 1.0),
    ('C-D', ST_SetSRID(ST_MakePoint(79.8700, 6.9401), 4326), ST_SetSRID(ST_MakePoint(79.8550, 6.9450), 4326),
     ST_MakeLine(ST_MakePoint(79.8700, 6.9401), ST_MakePoint(79.8550, 6.9450)), 'PASSABLE', 0.1, 0.1, 2.0);
