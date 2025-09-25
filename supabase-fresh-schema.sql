-- FRESH START: Air Quality Dashboard Database Schema
-- This script drops ALL existing tables and recreates them from scratch
-- ⚠️ WARNING: This will delete all existing data! ⚠️

-- Drop all existing tables and views (in correct dependency order)
DROP VIEW IF EXISTS current_openweather_station_3h_averages CASCADE;
DROP VIEW IF EXISTS current_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_station_readings CASCADE;
DROP TABLE IF EXISTS openweather_readings CASCADE;
DROP TABLE IF EXISTS air_quality_readings CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;

-- Drop all existing functions
DROP FUNCTION IF EXISTS calculate_aqhi(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_openweather_data() CASCADE;
DROP FUNCTION IF EXISTS update_station_timestamp() CASCADE;
DROP FUNCTION IF EXISTS get_api_usage_stats() CASCADE;
DROP FUNCTION IF EXISTS check_and_increment_api_usage() CASCADE;

-- Set timezone
ALTER DATABASE postgres SET timezone TO 'Asia/Bangkok';

-- Create stations table
CREATE TABLE stations (
    id SERIAL PRIMARY KEY,
    station_uid VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    city TEXT,
    country TEXT DEFAULT 'Thailand',
    url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create air quality readings table
CREATE TABLE air_quality_readings (
    id BIGSERIAL PRIMARY KEY,
    station_uid VARCHAR(50) NOT NULL REFERENCES stations(station_uid),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    aqi INTEGER,

    -- Pollutant concentrations (μg/m³ except CO which is mg/m³)
    pm25 DECIMAL(8, 2),
    pm10 DECIMAL(8, 2),
    o3 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),
    so2 DECIMAL(8, 2),
    co DECIMAL(8, 2),

    -- Weather data
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    pressure DECIMAL(7, 2),
    wind_speed DECIMAL(5, 2),
    wind_direction INTEGER,

    -- AQHI calculation
    aqhi DECIMAL(4, 1),

    -- Raw data for debugging
    raw_data JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure no duplicate readings for same station/time
    UNIQUE(station_uid, timestamp)
);

-- Create OpenWeather readings table for supplementary data
CREATE TABLE openweather_readings (
    id BIGSERIAL PRIMARY KEY,
    lat DECIMAL(10, 8) NOT NULL,
    lon DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Pollutant concentrations (μg/m³ except CO which is mg/m³)
    pm25 DECIMAL(8, 2),
    pm10 DECIMAL(8, 2),
    o3 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),
    so2 DECIMAL(8, 2),
    co DECIMAL(8, 2),

    -- Source tracking
    api_source TEXT DEFAULT 'openweather',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate readings for same location/time
    UNIQUE(lat, lon, timestamp)
);

-- Create API usage tracking table
CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    api_name TEXT NOT NULL,
    calls_used INTEGER DEFAULT 0,
    reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_readings_station_time ON air_quality_readings(station_uid, timestamp DESC);
CREATE INDEX idx_readings_timestamp ON air_quality_readings(timestamp DESC);
CREATE INDEX idx_readings_aqi ON air_quality_readings(aqi);
CREATE INDEX idx_stations_active ON stations(is_active) WHERE is_active = true;
CREATE INDEX idx_openweather_location_time ON openweather_readings(lat, lon, timestamp DESC);
CREATE INDEX idx_openweather_timestamp ON openweather_readings(timestamp DESC);

-- Create function to calculate AQHI (MUST be created before views that use it)
CREATE OR REPLACE FUNCTION calculate_aqhi(
    pm25_val DECIMAL,
    pm10_val DECIMAL,
    o3_val DECIMAL,
    no2_val DECIMAL,
    so2_val DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    aqhi_value DECIMAL;
    pm25_contribution DECIMAL := 0;
    o3_contribution DECIMAL := 0;
    no2_contribution DECIMAL := 0;
BEGIN
    -- AQHI calculation based on Health Canada formula
    -- AQHI = (10/10.4) * 100 * [(exp(0.000871 * O3) - 1) + (exp(0.000537 * NO2) - 1) + (exp(0.000487 * PM2.5) - 1)]

    IF pm25_val IS NOT NULL AND pm25_val > 0 THEN
        pm25_contribution := EXP(0.000487 * pm25_val) - 1;
    END IF;

    IF o3_val IS NOT NULL AND o3_val > 0 THEN
        o3_contribution := EXP(0.000871 * o3_val) - 1;
    END IF;

    IF no2_val IS NOT NULL AND no2_val > 0 THEN
        no2_contribution := EXP(0.000537 * no2_val) - 1;
    END IF;

    -- Calculate AQHI
    aqhi_value := (10.0/10.4) * 100 * (o3_contribution + no2_contribution + pm25_contribution);

    -- Round to 1 decimal place and ensure it's positive
    RETURN GREATEST(ROUND(aqhi_value, 1), 0);
END;
$$ LANGUAGE plpgsql;

-- Create view for current 3-hour averages (for AQHI calculation)
CREATE VIEW current_3h_averages AS
SELECT
    station_uid,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Create station-to-OpenWeather mapping view
CREATE VIEW current_openweather_station_3h_averages AS
SELECT
    s.station_uid,
    AVG(ow.pm25) as avg_pm25,
    AVG(ow.pm10) as avg_pm10,
    AVG(ow.o3) as avg_o3,
    AVG(ow.no2) as avg_no2,
    AVG(ow.so2) as avg_so2,
    AVG(ow.co) as avg_co,
    COUNT(*) as reading_count,
    MAX(ow.timestamp) as latest_reading,
    MIN(ow.timestamp) as earliest_reading
FROM openweather_readings ow
JOIN stations s ON (
    ABS(s.latitude - ow.lat) < 0.01 AND
    ABS(s.longitude - ow.lon) < 0.01
)
WHERE ow.timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY s.station_uid
HAVING COUNT(*) >= 1;

-- Create view for latest readings with AQHI
CREATE VIEW latest_station_readings AS
SELECT DISTINCT ON (r.station_uid)
    s.station_uid,
    s.name,
    s.latitude,
    s.longitude,
    r.timestamp,
    r.aqi,
    r.pm25,
    r.pm10,
    r.o3,
    r.no2,
    r.so2,
    r.co,
    r.temperature,
    r.humidity,
    r.pressure,
    r.wind_speed,
    r.wind_direction,
    calculate_aqhi(r.pm25, r.pm10, r.o3, r.no2, r.so2) as calculated_aqhi,
    r.aqhi as stored_aqhi
FROM air_quality_readings r
JOIN stations s ON r.station_uid = s.station_uid
WHERE s.is_active = true
ORDER BY r.station_uid, r.timestamp DESC;

-- Create function to cleanup old data (keep only last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM air_quality_readings
    WHERE timestamp < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old OpenWeather data
CREATE OR REPLACE FUNCTION cleanup_old_openweather_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM openweather_readings
    WHERE timestamp < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to update station last_updated timestamp
CREATE OR REPLACE FUNCTION update_station_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stations
    SET updated_at = NOW()
    WHERE station_uid = NEW.station_uid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to get API usage stats
CREATE OR REPLACE FUNCTION get_api_usage_stats()
RETURNS TABLE(api_name TEXT, calls_used INTEGER, reset_date DATE, calls_remaining INTEGER)
AS $$
BEGIN
    -- Reset daily usage if date changed
    UPDATE api_usage
    SET calls_used = 0, reset_date = CURRENT_DATE, updated_at = NOW()
    WHERE reset_date < CURRENT_DATE;

    RETURN QUERY
    SELECT
        a.api_name,
        a.calls_used,
        a.reset_date,
        CASE
            WHEN a.api_name = 'openweather' THEN 1000 - a.calls_used
            ELSE 0
        END as calls_remaining
    FROM api_usage a;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment API usage
CREATE OR REPLACE FUNCTION check_and_increment_api_usage()
RETURNS BOOLEAN
AS $$
DECLARE
    current_usage INTEGER;
    daily_limit INTEGER := 1000;
BEGIN
    -- Get current usage for OpenWeather API
    SELECT calls_used INTO current_usage
    FROM api_usage
    WHERE api_name = 'openweather' AND reset_date = CURRENT_DATE;

    -- If no record exists, create one
    IF current_usage IS NULL THEN
        INSERT INTO api_usage (api_name, calls_used, reset_date)
        VALUES ('openweather', 1, CURRENT_DATE);
        RETURN TRUE;
    END IF;

    -- Check if we're under the limit
    IF current_usage < daily_limit THEN
        UPDATE api_usage
        SET calls_used = calls_used + 1, updated_at = NOW()
        WHERE api_name = 'openweather' AND reset_date = CURRENT_DATE;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update station timestamp
CREATE TRIGGER trigger_update_station_timestamp
    AFTER INSERT ON air_quality_readings
    FOR EACH ROW
    EXECUTE FUNCTION update_station_timestamp();

-- Insert initial API usage tracking
INSERT INTO api_usage (api_name, calls_used, reset_date)
VALUES ('openweather', 0, CURRENT_DATE);

-- Success message
SELECT '🎉 Fresh Supabase schema created successfully!' as message;
SELECT 'All tables, views, and functions have been recreated from scratch.' as info;