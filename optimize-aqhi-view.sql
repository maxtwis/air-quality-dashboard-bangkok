-- Optimization: Add pre-calculated AQHI to combined_3h_averages view
-- This eliminates the need to calculate AQHI in JavaScript for every station
-- Run this in Supabase SQL Editor to speed up AQHI loading significantly

-- Drop and recreate combined_3h_averages with AQHI calculation
DROP VIEW IF EXISTS combined_3h_averages CASCADE;

CREATE VIEW combined_3h_averages AS
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
    MIN(timestamp) as earliest_reading,
    -- PRE-CALCULATE AQHI IN THE DATABASE (HUGE PERFORMANCE WIN!)
    calculate_aqhi(
        AVG(pm25),
        AVG(pm10),
        AVG(o3),
        AVG(no2),
        AVG(so2)
    ) as aqhi
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Create index on station_uid for faster lookups
CREATE INDEX IF NOT EXISTS idx_combined_3h_station
ON air_quality_readings(station_uid)
WHERE timestamp >= NOW() - INTERVAL '3 hours';

-- Verify the view works
SELECT station_uid, avg_pm25, avg_no2, avg_o3, aqhi, reading_count
FROM combined_3h_averages
LIMIT 5;
