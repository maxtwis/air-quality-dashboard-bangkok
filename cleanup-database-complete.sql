-- Complete Database Cleanup for Air Quality Dashboard
-- This script removes AQI data and old records to free up database space
-- Current: 1,434,245 records (~684 MB) with AQI column
-- Expected result: ~10,000-15,000 records (~3-5 MB) AQHI-only

-- ============================================================================
-- STEP 1: ANALYZE CURRENT STATE
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '📊 CURRENT DATABASE STATE' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- Table size before cleanup
SELECT
    'waqi_data table size' as metric,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS total_size,
    pg_size_pretty(pg_relation_size('waqi_data')) AS table_size,
    pg_size_pretty(pg_total_relation_size('waqi_data') - pg_relation_size('waqi_data')) AS index_size;

-- Record counts by time period
SELECT
    '📈 Records by time period' as section,
    'Last 24 hours' as period,
    COUNT(*) as record_count
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    '',
    'Last 7 days',
    COUNT(*)
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT
    '',
    'Total (all time)',
    COUNT(*)
FROM waqi_data;

-- ============================================================================
-- STEP 2: BACKUP RECENT DATA (Optional - for safety)
-- ============================================================================

-- Create temporary backup table with last 7 days of data
-- Uncomment if you want to keep a backup before cleanup
-- CREATE TABLE waqi_data_backup AS
-- SELECT * FROM waqi_data
-- WHERE timestamp >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- STEP 3: DELETE OLD RECORDS
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '🗑️  DELETING OLD RECORDS (keeping last 7 days)' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

BEGIN;

-- Delete records older than 7 days
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '7 days';

-- Get count of remaining records
SELECT
    '✅ Deletion complete' as status,
    COUNT(*) as remaining_records,
    MIN(timestamp) as oldest_record,
    MAX(timestamp) as newest_record
FROM waqi_data;

COMMIT;

-- ============================================================================
-- STEP 4: REMOVE AQI COLUMN
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '🔧 REMOVING AQI COLUMN' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

BEGIN;

-- Drop AQI-related indexes
DROP INDEX IF EXISTS idx_waqi_aqi;
DROP INDEX IF EXISTS idx_readings_aqi;

-- Drop AQI column from waqi_data
ALTER TABLE waqi_data DROP COLUMN IF EXISTS aqi;

-- Drop AQI column from air_quality_readings (if exists)
ALTER TABLE air_quality_readings DROP COLUMN IF EXISTS aqi;

SELECT '✅ AQI column removed' as status;

COMMIT;

-- ============================================================================
-- STEP 5: RECLAIM DISK SPACE
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '💾 RECLAIMING DISK SPACE' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- Regular vacuum (safe during operation)
VACUUM ANALYZE waqi_data;
VACUUM ANALYZE air_quality_readings;

-- For maximum space recovery, run this during maintenance window:
-- VACUUM FULL waqi_data;

-- ============================================================================
-- STEP 6: VERIFY RESULTS
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '✅ CLEANUP COMPLETE - RESULTS' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- New table size
SELECT
    'New waqi_data size' as metric,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS total_size,
    pg_size_pretty(pg_relation_size('waqi_data')) AS table_size,
    pg_size_pretty(pg_total_relation_size('waqi_data') - pg_relation_size('waqi_data')) AS index_size;

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
    column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'waqi_data'
AND column_name = 'aqi';

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '🎉 SUCCESS!' as status;
SELECT 'Database is now optimized for AQHI-only mode' as message;
SELECT '💡 Tip: Run VACUUM FULL waqi_data during maintenance for maximum space recovery' as tip;
SELECT '═══════════════════════════════════════════════════════════' as divider;
