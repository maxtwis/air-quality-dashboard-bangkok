-- FRESH START: Air Quality Dashboard Database Schema
-- This script drops ALL existing tables and recreates them from scratch
-- ⚠️ WARNING: This will delete all existing data! ⚠️

-- Drop all existing tables and views (in correct dependency order)
DROP VIEW IF EXISTS current_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_station_readings CASCADE;
DROP TABLE IF EXISTS air_quality_readings CASCADE;
DROP TABLE IF EXISTS stations CASCADE;

-- Drop all existing functions
DROP FUNCTION IF EXISTS calculate_aqhi(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;
DROP FUNCTION IF EXISTS update_station_timestamp() CASCADE;

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

-- Create indexes for performance
CREATE INDEX idx_readings_station_time ON air_quality_readings(station_uid, timestamp DESC);
CREATE INDEX idx_readings_timestamp ON air_quality_readings(timestamp DESC);
CREATE INDEX idx_readings_aqi ON air_quality_readings(aqi);
CREATE INDEX idx_stations_active ON stations(is_active) WHERE is_active = true;

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
    pm10_contribution DECIMAL := 0;
    o3_contribution DECIMAL := 0;
    no2_contribution DECIMAL := 0;
    so2_contribution DECIMAL := 0;
BEGIN
    -- AQHI calculation based on Thai Health Department formula
    -- AQHI = (10/105.19) * Total %ER
    -- %ER_i = 100 * (exp(βi * xi) - 1)
    -- β coefficients: PM2.5: 0.0012, PM10: 0.0012, NO₂: 0.0052, O₃: 0.0010

    IF pm25_val IS NOT NULL AND pm25_val > 0 THEN
        pm25_contribution := 100 * (EXP(0.0012 * pm25_val) - 1);
    END IF;

    IF pm10_val IS NOT NULL AND pm10_val > 0 THEN
        pm10_contribution := 100 * (EXP(0.0012 * pm10_val) - 1);
    END IF;

    IF o3_val IS NOT NULL AND o3_val > 0 THEN
        o3_contribution := 100 * (EXP(0.0010 * o3_val) - 1);
    END IF;

    IF no2_val IS NOT NULL AND no2_val > 0 THEN
        no2_contribution := 100 * (EXP(0.0052 * no2_val) - 1);
    END IF;

    IF so2_val IS NOT NULL AND so2_val > 0 THEN
        so2_contribution := 100 * (EXP(0.0 * so2_val) - 1);
    END IF;

    -- Calculate AQHI: (10/C) * Total %ER
    aqhi_value := (10.0/105.19) * (pm25_contribution + pm10_contribution + o3_contribution + no2_contribution + so2_contribution);

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

-- Create trigger to automatically update station timestamp
CREATE TRIGGER trigger_update_station_timestamp
    AFTER INSERT ON air_quality_readings
    FOR EACH ROW
    EXECUTE FUNCTION update_station_timestamp();

-- Success message
SELECT '🎉 Fresh Supabase schema created successfully!' as message;
SELECT 'All tables, views, and functions have been recreated from scratch.' as info;