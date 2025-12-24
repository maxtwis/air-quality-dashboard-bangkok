-- Step 2: Remove AQI Column (Run this AFTER cleanup-database-batched.sql)
-- This is a separate script to avoid timeouts
-- Must be run AFTER old records are deleted

-- ============================================================================
-- REMOVE AQI COLUMN AND INDEXES
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '🔧 REMOVING AQI COLUMN' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

BEGIN;

-- Drop AQI-related indexes (fast operation)
DROP INDEX IF EXISTS idx_waqi_aqi;
DROP INDEX IF EXISTS idx_readings_aqi;

-- Drop AQI column from waqi_data (should be fast now that table is smaller)
ALTER TABLE waqi_data DROP COLUMN IF EXISTS aqi;

-- Drop AQI column from air_quality_readings (if exists)
ALTER TABLE air_quality_readings DROP COLUMN IF EXISTS aqi;

SELECT '✅ AQI column and indexes removed' as status;

COMMIT;

-- ============================================================================
-- RECLAIM DISK SPACE
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '💾 RECLAIMING DISK SPACE' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- Regular vacuum (safe, non-blocking)
VACUUM ANALYZE waqi_data;
VACUUM ANALYZE air_quality_readings;

SELECT '✅ Vacuum complete' as status;
SELECT '💡 For maximum space recovery, run VACUUM FULL during maintenance' as tip;

-- ============================================================================
-- VERIFY RESULTS
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '✅ CLEANUP COMPLETE - RESULTS' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- New table size
SELECT
    'New waqi_data size' as metric,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS total_size,
    pg_size_pretty(pg_relation_size('waqi_data')) AS table_size;

-- Final record count
SELECT
    'Final statistics' as metric,
    COUNT(*) as total_records,
    COUNT(DISTINCT station_uid) as unique_stations,
    MIN(timestamp) as oldest_record,
    MAX(timestamp) as newest_record
FROM waqi_data;

-- Verify AQI column is gone (should return 0 rows)
SELECT
    'AQI column check' as metric,
    COALESCE(COUNT(*), 0) as aqi_columns_found
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'waqi_data'
AND column_name = 'aqi';

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '🎉 SUCCESS!' as status;
SELECT 'Database is now optimized for AQHI-only mode' as message;
SELECT '═══════════════════════════════════════════════════════════' as divider;
