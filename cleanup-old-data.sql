-- Clean up old AQI data from Supabase to start fresh with correct concentrations
-- Run this in your Supabase SQL Editor

-- STEP 1: Check what data you currently have
SELECT
    COUNT(*) as total_readings,
    MIN(timestamp) as oldest_reading,
    MAX(timestamp) as newest_reading,
    COUNT(DISTINCT station_uid) as unique_stations
FROM air_quality_readings;

-- STEP 2: Sample some data to verify it contains AQI values (not concentrations)
-- AQI values are typically 0-500, concentrations are usually much lower
SELECT
    station_uid,
    timestamp,
    pm25,
    pm10,
    o3,
    no2,
    aqi
FROM air_quality_readings
WHERE pm25 IS NOT NULL
ORDER BY timestamp DESC
LIMIT 10;

-- STEP 3: Check for any recent correct data (if data_converted column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'air_quality_readings'
               AND column_name = 'data_converted') THEN
        -- Show converted vs unconverted data
        RAISE NOTICE 'Checking for converted data...';
        PERFORM * FROM air_quality_readings WHERE data_converted = TRUE LIMIT 1;
        IF FOUND THEN
            RAISE NOTICE 'Found some converted data - consider keeping it';
        ELSE
            RAISE NOTICE 'No converted data found - safe to clean up all data';
        END IF;
    ELSE
        RAISE NOTICE 'No data_converted column - all data is likely AQI values';
    END IF;
END $$;

-- STEP 4: Clean up old incorrect data
-- UNCOMMENT THESE LINES AFTER REVIEWING THE ABOVE RESULTS:

/*
-- Delete all readings with AQI values (not concentrations)
DELETE FROM air_quality_readings
WHERE data_converted IS NULL
   OR data_converted = FALSE
   OR data_converted IS NOT TRUE;

-- If no data_converted column exists, delete all data:
-- DELETE FROM air_quality_readings;

-- Reset the sequence for clean numbering
ALTER SEQUENCE air_quality_readings_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT COUNT(*) as remaining_readings FROM air_quality_readings;
*/

-- STEP 5: Verify your data collection is working
-- Your enhanced collection should now store concentrations properly
SELECT 'Cleanup script ready. Review results above, then uncomment STEP 4 to execute cleanup.' as status;

-- STEP 6: After cleanup, test with fresh data collection
-- The next cron job will populate with correct concentration values