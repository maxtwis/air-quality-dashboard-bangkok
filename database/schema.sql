-- Database schema for storing historical air quality data
-- Compatible with PostgreSQL, MySQL, and other SQL databases

-- Main table for storing air quality readings
CREATE TABLE air_quality_readings (
    id SERIAL PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    aqi INTEGER,
    
    -- Pollutant concentrations (μg/m³)
    pm25 DECIMAL(8, 2) DEFAULT 0,
    pm10 DECIMAL(8, 2) DEFAULT 0,
    no2 DECIMAL(8, 2) DEFAULT 0,
    o3 DECIMAL(8, 2) DEFAULT 0,
    so2 DECIMAL(8, 2) DEFAULT 0,
    co DECIMAL(8, 2) DEFAULT 0,
    
    -- Station metadata
    station_name VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_station_timestamp ON air_quality_readings(station_uid, timestamp DESC);
CREATE INDEX idx_timestamp ON air_quality_readings(timestamp DESC);
CREATE INDEX idx_station_uid ON air_quality_readings(station_uid);

-- Table for pre-calculated 3-hour moving averages (optional optimization)
CREATE TABLE moving_averages_3h (
    id SERIAL PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- 3-hour averages
    pm25_avg DECIMAL(8, 2),
    pm10_avg DECIMAL(8, 2),
    no2_avg DECIMAL(8, 2),
    o3_avg DECIMAL(8, 2),
    so2_avg DECIMAL(8, 2),
    co_avg DECIMAL(8, 2),
    
    -- AQHI calculation
    aqhi DECIMAL(4, 1),
    
    -- Data quality metrics
    data_points INTEGER,
    completeness_ratio DECIMAL(3, 2), -- 0.0 to 1.0
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ma_station_timestamp ON moving_averages_3h(station_uid, timestamp DESC);

-- Station metadata table
CREATE TABLE stations (
    uid INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Thailand',
    
    -- Sensor capabilities
    has_pm25 BOOLEAN DEFAULT FALSE,
    has_pm10 BOOLEAN DEFAULT FALSE,
    has_no2 BOOLEAN DEFAULT FALSE,
    has_o3 BOOLEAN DEFAULT FALSE,
    has_so2 BOOLEAN DEFAULT FALSE,
    has_co BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- View for easy querying of recent 3-hour averages
CREATE OR REPLACE VIEW recent_3h_averages AS
SELECT 
    r.station_uid,
    s.name as station_name,
    s.lat,
    s.lon,
    
    -- Calculate 3-hour averages
    AVG(NULLIF(r.pm25, 0)) as pm25_3h_avg,
    AVG(NULLIF(r.no2, 0)) as no2_3h_avg,
    AVG(NULLIF(r.o3, 0)) as o3_3h_avg,
    AVG(NULLIF(r.so2, 0)) as so2_3h_avg,
    AVG(NULLIF(r.pm10, 0)) as pm10_3h_avg,
    AVG(NULLIF(r.co, 0)) as co_3h_avg,
    
    -- Data quality metrics
    COUNT(*) as reading_count,
    MIN(r.timestamp) as oldest_reading,
    MAX(r.timestamp) as newest_reading,
    
    -- Most recent individual reading
    (SELECT pm25 FROM air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_pm25,
    (SELECT no2 FROM air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_no2,
    (SELECT o3 FROM air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_o3,
    (SELECT so2 FROM air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_so2,
    (SELECT aqi FROM air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_aqi

FROM air_quality_readings r
JOIN stations s ON r.station_uid = s.uid
WHERE r.timestamp >= NOW() - INTERVAL '3 hours'
  AND s.is_active = TRUE
GROUP BY r.station_uid, s.name, s.lat, s.lon;

-- Function to calculate AQHI (PostgreSQL example)
CREATE OR REPLACE FUNCTION calculate_aqhi(
    pm25_val DECIMAL DEFAULT 0,
    no2_val DECIMAL DEFAULT 0,
    o3_val DECIMAL DEFAULT 0,
    so2_val DECIMAL DEFAULT 0
) RETURNS DECIMAL AS $$
DECLARE
    pm25_component DECIMAL;
    no2_component DECIMAL;
    o3_component DECIMAL;
    so2_component DECIMAL;
    aqhi_result DECIMAL;
BEGIN
    -- AQHI formula components
    pm25_component := 100 * (EXP(0.0012 * COALESCE(pm25_val, 0)) - 1);
    no2_component := EXP(0.0052 * COALESCE(no2_val, 0)) - 1;
    o3_component := EXP(0.001 * COALESCE(o3_val, 0)) - 1;
    so2_component := EXP(0.0038 * COALESCE(so2_val, 0)) - 1;
    
    -- Calculate final AQHI
    aqhi_result := (10.0 / 105.19) * (pm25_component + no2_component + o3_component + so2_component);
    
    -- Round to 1 decimal place
    RETURN ROUND(aqhi_result, 1);
END;
$$ LANGUAGE plpgsql;

-- Cleanup old data (keep only 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_readings()
RETURNS void AS $$
BEGIN
    DELETE FROM air_quality_readings 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    DELETE FROM moving_averages_3h 
    WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Sample queries for testing
/*
-- Insert sample data
INSERT INTO stations (uid, name, lat, lon, has_pm25, has_no2, has_o3, has_so2) VALUES
(5773, 'Bangkok Test Station', 13.7563, 100.5018, true, true, true, true);

INSERT INTO air_quality_readings (station_uid, timestamp, lat, lon, aqi, pm25, no2, o3, so2, station_name) VALUES
(5773, NOW(), 13.7563, 100.5018, 85, 75, 45, 35, 25, 'Bangkok Test Station');

-- Query 3-hour averages
SELECT * FROM recent_3h_averages WHERE station_uid = 5773;

-- Calculate AQHI
SELECT station_uid, calculate_aqhi(pm25_3h_avg, no2_3h_avg, o3_3h_avg, so2_3h_avg) as aqhi
FROM recent_3h_averages;
*/