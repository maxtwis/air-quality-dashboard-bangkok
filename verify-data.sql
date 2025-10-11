-- Verify Google Supplements Data in Supabase
-- Run these queries to check everything is working

-- 1. Check total supplements stored
SELECT
    COUNT(*) as total_supplements,
    MAX(timestamp) as latest_supplement,
    MIN(timestamp) as earliest_supplement
FROM google_supplements;

-- 2. View sample data
SELECT
    station_uid,
    timestamp,
    o3,
    no2,
    grid_lat,
    grid_lon
FROM google_supplements
ORDER BY timestamp DESC
LIMIT 10;

-- 3. Check grid distribution
SELECT
    grid_lat,
    grid_lon,
    COUNT(*) as station_count,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2
FROM google_supplements
GROUP BY grid_lat, grid_lon
ORDER BY station_count DESC;

-- 4. Check which stations got supplements
SELECT
    station_uid,
    o3,
    no2,
    timestamp
FROM latest_google_supplements
ORDER BY station_uid
LIMIT 20;

-- 5. Check if any stations have NULL values
SELECT
    COUNT(*) as total_records,
    COUNT(o3) as records_with_o3,
    COUNT(no2) as records_with_no2,
    COUNT(*) - COUNT(o3) as missing_o3,
    COUNT(*) - COUNT(no2) as missing_no2
FROM google_supplements;
