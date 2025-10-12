-- Alternative: Show ALL stations using latest readings (not 3h average)
-- This will show all 139 stations immediately
-- Run this in Supabase SQL Editor

-- Option 1: Use latest readings with fallback to 3h averages
DROP VIEW IF EXISTS combined_3h_averages CASCADE;

CREATE VIEW combined_3h_averages AS
SELECT
    COALESCE(w.station_uid, lcr.station_uid) as station_uid,
    -- Use 3h average if available, otherwise use latest reading
    COALESCE(w.avg_pm25, lcr.pm25) as avg_pm25,
    COALESCE(w.avg_pm10, lcr.pm10) as avg_pm10,
    COALESCE(w.avg_so2, lcr.so2) as avg_so2,
    COALESCE(w.avg_co, lcr.co) as avg_co,
    -- O3/NO2: Prefer WAQI 3h avg, then Google 3h avg, then latest reading
    COALESCE(w.avg_o3, g.avg_o3, lcr.o3) as avg_o3,
    COALESCE(w.avg_no2, g.avg_no2, lcr.no2) as avg_no2,
    -- Track source
    CASE
        WHEN w.avg_o3 IS NOT NULL THEN 'WAQI'
        WHEN g.avg_o3 IS NOT NULL THEN 'GOOGLE'
        ELSE 'LATEST'
    END as o3_source,
    CASE
        WHEN w.avg_no2 IS NOT NULL THEN 'WAQI'
        WHEN g.avg_no2 IS NOT NULL THEN 'GOOGLE'
        ELSE 'LATEST'
    END as no2_source,
    -- Reading counts
    COALESCE(w.reading_count, 1) as waqi_readings,
    g.reading_count as google_readings,
    -- Timestamps
    COALESCE(w.latest_reading, lcr.waqi_timestamp) as waqi_latest,
    g.latest_reading as google_latest,
    -- Data quality
    CASE
        WHEN w.reading_count >= 9 AND g.reading_count >= 3 THEN 'EXCELLENT'
        WHEN w.reading_count >= 5 AND g.reading_count >= 2 THEN 'GOOD'
        WHEN w.reading_count >= 3 OR g.reading_count >= 1 THEN 'FAIR'
        ELSE 'LIMITED'
    END as data_quality
FROM latest_combined_readings lcr
LEFT JOIN waqi_3h_averages w ON lcr.station_uid = w.station_uid
LEFT JOIN google_3h_averages g ON lcr.station_uid = g.station_uid;

-- Verify: Should now show all 139 stations
SELECT COUNT(*) as total_stations FROM combined_3h_averages;

-- Check quality distribution
SELECT
    data_quality,
    COUNT(*) as station_count
FROM combined_3h_averages
GROUP BY data_quality
ORDER BY
    CASE data_quality
        WHEN 'EXCELLENT' THEN 1
        WHEN 'GOOD' THEN 2
        WHEN 'FAIR' THEN 3
        WHEN 'LIMITED' THEN 4
    END;
