-- Air Quality Dashboard Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable Row Level Security (RLS)
ALTER DATABASE postgres SET timezone TO 'Asia/Bangkok';

-- Create stations table
CREATE TABLE IF NOT EXISTS stations (
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
CREATE TABLE IF NOT EXISTS air_quality_readings (
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
CREATE INDEX IF NOT EXISTS idx_readings_station_time
ON air_quality_readings(station_uid, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_readings_timestamp
ON air_quality_readings(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_readings_aqi
ON air_quality_readings(aqi);

CREATE INDEX IF NOT EXISTS idx_stations_active
ON stations(is_active) WHERE is_active = true;

-- Create view for current 3-hour averages (for AQHI calculation)
CREATE OR REPLACE VIEW current_3h_averages AS
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
HAVING COUNT(*) >= 1; -- At least 1 reading in the last 3 hours

-- Create function to calculate AQHI
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
DROP TRIGGER IF EXISTS trigger_update_station_timestamp ON air_quality_readings;
CREATE TRIGGER trigger_update_station_timestamp
    AFTER INSERT ON air_quality_readings
    FOR EACH ROW
    EXECUTE FUNCTION update_station_timestamp();

-- Enable Row Level Security (optional - disable if you want public access)
-- ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE air_quality_readings ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (uncomment if using RLS)
-- CREATE POLICY "Allow public read access on stations" ON stations FOR SELECT USING (true);
-- CREATE POLICY "Allow public read access on readings" ON air_quality_readings FOR SELECT USING (true);

-- Create function to get latest readings with AQHI
CREATE OR REPLACE VIEW latest_station_readings AS
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

-- Insert sample data (optional)
-- You can uncomment this after setting up your first API data collection

/*
INSERT INTO stations (station_uid, name, latitude, longitude, city) VALUES
('bangkok-embassy', 'US Embassy Bangkok', 13.7563, 100.5018, 'Bangkok'),
('bangkok-chatuchak', 'Chatuchak Park', 13.8037, 100.5532, 'Bangkok'),
('bangkok-thonburi', 'Thonburi', 13.7244, 100.4666, 'Bangkok')
ON CONFLICT (station_uid) DO NOTHING;
*/

-- Show some helpful information
SELECT 'Database schema created successfully!' as message;
SELECT 'Next steps:' as info, '1. Update your .env file with Supabase credentials' as step1, '2. Test the connection' as step2;