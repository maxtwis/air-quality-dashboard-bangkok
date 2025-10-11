-- Verify that WAQI data is preferred over Google supplements
-- Run this in Supabase SQL Editor to check the fix

-- Check how many stations have O3/NO2 from each source
SELECT
    o3_source,
    COUNT(*) as stations_with_o3,
    AVG(avg_o3) as avg_o3_value
FROM combined_3h_averages
WHERE avg_o3 IS NOT NULL
GROUP BY o3_source;

SELECT
    no2_source,
    COUNT(*) as stations_with_no2,
    AVG(avg_no2) as avg_no2_value
FROM combined_3h_averages
WHERE avg_no2 IS NOT NULL
GROUP BY no2_source;

-- Sample data showing source priority
SELECT
    station_uid,
    avg_o3,
    o3_source,
    avg_no2,
    no2_source,
    waqi_readings,
    google_readings
FROM combined_3h_averages
WHERE avg_o3 IS NOT NULL OR avg_no2 IS NOT NULL
ORDER BY station_uid
LIMIT 20;

-- Check if any stations have both WAQI and Google data
-- (Should show Google is NOT being used when WAQI has data)
SELECT
    COUNT(*) as stations_with_waqi_o3_and_google_data
FROM waqi_3h_averages w
INNER JOIN google_3h_averages g ON w.station_uid = g.station_uid
WHERE w.avg_o3 IS NOT NULL;

SELECT
    COUNT(*) as stations_with_waqi_no2_and_google_data
FROM waqi_3h_averages w
INNER JOIN google_3h_averages g ON w.station_uid = g.station_uid
WHERE w.avg_no2 IS NOT NULL;
