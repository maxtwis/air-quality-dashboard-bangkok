-- Simple cleanup for Supabase database without data_converted column
-- This removes old AQI data to prepare for correct concentration data

-- STEP 1: Check current data (AQI values are typically 0-500)
SELECT
    COUNT(*) as total_readings,
    MIN(timestamp) as oldest_reading,
    MAX(timestamp) as newest_reading,
    COUNT(DISTINCT station_uid) as unique_stations,
    'Current data contains AQI values (not concentrations)' as note
FROM air_quality_readings;

-- STEP 2: Show sample data to confirm these are AQI values
SELECT
    station_uid,
    timestamp,
    pm25,
    pm10,
    o3,
    no2,
    aqi,
    'These PM2.5/PM10 values look like AQI (0-500) not concentrations (μg/m³)' as analysis
FROM air_quality_readings
WHERE pm25 IS NOT NULL
ORDER BY timestamp DESC
LIMIT 5;

-- STEP 3: Clean up all old data (since it contains AQI values)
-- UNCOMMENT THE NEXT 3 LINES AFTER REVIEWING THE DATA ABOVE:

/*
DELETE FROM air_quality_readings;
ALTER SEQUENCE air_quality_readings_id_seq RESTART WITH 1;
SELECT 'Old AQI data cleaned up successfully!' as status;
*/

-- STEP 4: Verify cleanup
-- UNCOMMENT AFTER RUNNING THE DELETE:
/*
SELECT
    COUNT(*) as remaining_readings,
    'Database ready for correct concentration data' as status
FROM air_quality_readings;
*/