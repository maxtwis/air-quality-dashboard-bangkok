-- Air Quality Dashboard - Remove AQI Data to Free Up Space
-- This script removes the AQI column from waqi_data table to reduce database size
-- Current: ~1.4M records with AQI data
-- Expected savings: ~10-15% of storage space

-- IMPORTANT: This is a destructive operation.
-- Make sure you have a backup or are OK with losing AQI historical data.
-- The dashboard will use AQHI only after this change.

BEGIN;

-- Step 1: Check current table structure
SELECT
    'Current waqi_data structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'waqi_data'
ORDER BY ordinal_position;

-- Step 2: Get current record count and table size
SELECT
    'Current table statistics' as info,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'waqi_data';

-- Step 3: Drop the AQI column index if it exists
DROP INDEX IF EXISTS idx_readings_aqi;
DROP INDEX IF EXISTS idx_waqi_aqi;

-- Step 4: Drop the AQI column from waqi_data table
ALTER TABLE waqi_data DROP COLUMN IF EXISTS aqi;

-- Step 5: Drop AQI column from air_quality_readings if it exists
ALTER TABLE air_quality_readings DROP COLUMN IF EXISTS aqi;

-- Step 6: Vacuum the table to reclaim space (runs asynchronously)
-- Note: VACUUM FULL would reclaim more space but requires exclusive lock
-- For production, run this during maintenance window:
-- VACUUM FULL waqi_data;

-- For now, just run regular vacuum which is safe during operation
VACUUM ANALYZE waqi_data;
VACUUM ANALYZE air_quality_readings;

-- Step 7: Check new table size
SELECT
    'New table statistics' as info,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'waqi_data';

COMMIT;

-- Success message
SELECT '✅ AQI column removed successfully!' as result;
SELECT '💡 To reclaim maximum space, run VACUUM FULL waqi_data during maintenance window' as tip;
SELECT '📊 AQHI-only mode is now active' as status;
