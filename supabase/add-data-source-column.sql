-- Add data_source column to track WAQI vs Google data
-- Run this in your Supabase SQL Editor

-- Add data_source column to air_quality_readings table
ALTER TABLE air_quality_readings
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'WAQI';

-- Add check constraint to ensure only valid sources
ALTER TABLE air_quality_readings
ADD CONSTRAINT check_data_source
CHECK (data_source IN ('WAQI', 'GOOGLE'));

-- Create index for filtering by data source
CREATE INDEX IF NOT EXISTS idx_readings_data_source
ON air_quality_readings(data_source);

-- Add data_source to stations table as well
ALTER TABLE stations
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'WAQI';

ALTER TABLE stations
ADD CONSTRAINT check_station_data_source
CHECK (data_source IN ('WAQI', 'GOOGLE'));

-- Update the 3-hour averages view to include data source
DROP VIEW IF EXISTS current_3h_averages CASCADE;

CREATE VIEW current_3h_averages AS
SELECT
    station_uid,
    data_source,
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
GROUP BY station_uid, data_source
HAVING COUNT(*) >= 1;

-- Create view for current 3-hour averages by source (for easy filtering)
CREATE OR REPLACE VIEW current_3h_averages_by_source AS
SELECT
    station_uid,
    data_source,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading,
    -- Calculate AQHI using existing function
    calculate_aqhi(
        AVG(pm25),
        AVG(pm10),
        AVG(o3),
        AVG(no2),
        AVG(so2)
    ) as aqhi
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid, data_source
HAVING COUNT(*) >= 1;

COMMENT ON COLUMN air_quality_readings.data_source IS 'Source of the data: WAQI or GOOGLE';
COMMENT ON COLUMN stations.data_source IS 'Primary data source for this station: WAQI or GOOGLE';
