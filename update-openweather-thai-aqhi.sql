-- Update OpenWeather views to include Thai AQHI calculations
-- Run this AFTER running update-to-thai-aqhi-formula.sql

-- Update the OpenWeather station mapping view to include Thai AQHI
DROP VIEW IF EXISTS current_openweather_station_3h_averages CASCADE;

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
    MIN(ow.timestamp) as earliest_reading,
    -- Calculate Thai AQHI from OpenWeather 3-hour averages (all in μg/m³)
    calculate_thai_aqhi_from_ugm3(
        AVG(ow.pm25),
        AVG(ow.o3),
        AVG(ow.no2)
    ) as openweather_thai_aqhi_3h_avg
FROM openweather_readings ow
JOIN stations s ON (
    ABS(s.latitude - ow.lat) < 0.01 AND
    ABS(s.longitude - ow.lon) < 0.01
)
WHERE ow.timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY s.station_uid
HAVING COUNT(*) >= 1;

-- Create a unified view that combines AQICN and OpenWeather AQHI values
CREATE VIEW unified_station_aqhi AS
SELECT
    COALESCE(aqicn.station_uid, ow.station_uid) as station_uid,
    -- Prioritize AQICN data, supplement with OpenWeather
    COALESCE(aqicn.avg_pm25, ow.avg_pm25) as best_avg_pm25,
    COALESCE(aqicn.avg_o3, ow.avg_o3) as best_avg_o3,
    COALESCE(aqicn.avg_no2, ow.avg_no2) as best_avg_no2,
    COALESCE(aqicn.avg_so2, ow.avg_so2) as best_avg_so2,
    COALESCE(aqicn.avg_co, ow.avg_co) as best_avg_co,
    -- AQHI calculations
    aqicn.thai_aqhi_3h_avg as aqicn_thai_aqhi,
    ow.openweather_thai_aqhi_3h_avg as openweather_thai_aqhi,
    -- Unified Thai AQHI (calculated from best available data)
    calculate_thai_aqhi_from_ugm3(
        COALESCE(aqicn.avg_pm25, ow.avg_pm25),
        COALESCE(aqicn.avg_o3, ow.avg_o3),
        COALESCE(aqicn.avg_no2, ow.avg_no2)
    ) as unified_thai_aqhi,
    -- Data source information
    CASE
        WHEN aqicn.station_uid IS NOT NULL AND ow.station_uid IS NOT NULL THEN 'mixed'
        WHEN aqicn.station_uid IS NOT NULL THEN 'aqicn_only'
        WHEN ow.station_uid IS NOT NULL THEN 'openweather_only'
        ELSE 'no_data'
    END as data_source,
    aqicn.reading_count as aqicn_reading_count,
    ow.reading_count as openweather_reading_count,
    GREATEST(
        COALESCE(aqicn.latest_reading, '1900-01-01'::timestamp),
        COALESCE(ow.latest_reading, '1900-01-01'::timestamp)
    ) as latest_reading
FROM current_3h_averages aqicn
FULL OUTER JOIN current_openweather_station_3h_averages ow
    ON aqicn.station_uid = ow.station_uid;

-- Test the updated views
SELECT '✅ OpenWeather Thai AQHI views updated!' as message;
SELECT 'OpenWeather O3/NO2 in μg/m³ automatically converted to ppb for Thai AQHI calculation' as note;

-- Show sample data from unified view
SELECT
    station_uid,
    unified_thai_aqhi,
    data_source,
    aqicn_reading_count,
    openweather_reading_count
FROM unified_station_aqhi
ORDER BY unified_thai_aqhi DESC NULLS LAST
LIMIT 5;