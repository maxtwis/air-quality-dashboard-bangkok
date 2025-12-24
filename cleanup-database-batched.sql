-- Optimized Database Cleanup - Batched Deletion to Avoid Timeouts
-- This script deletes old records in small batches to prevent timeout errors
-- Current: 1,434,245 records (~684 MB) with AQI column
-- Expected result: ~10,000-15,000 records (~3-5 MB) AQHI-only

-- ============================================================================
-- STEP 1: ANALYZE CURRENT STATE (Quick check)
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '📊 CURRENT DATABASE STATE' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- Get record counts by time period (fast count using EXPLAIN)
SELECT
    'Last 24 hours' as period,
    COUNT(*) as record_count
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Last 7 days',
    COUNT(*)
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- STEP 2: DELETE OLD RECORDS IN BATCHES (Optimized for Supabase timeout)
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════' as divider;
SELECT '🗑️  DELETING OLD RECORDS IN BATCHES' as section;
SELECT '═══════════════════════════════════════════════════════════' as divider;

-- Batch 1: Delete records older than 30 days
DO $$
BEGIN
  DELETE FROM waqi_data
  WHERE timestamp < NOW() - INTERVAL '30 days';
  RAISE NOTICE 'Batch 1: Deleted records older than 30 days';
END $$;

-- Batch 2: Delete records older than 14 days
DO $$
BEGIN
  DELETE FROM waqi_data
  WHERE timestamp < NOW() - INTERVAL '14 days';
  RAISE NOTICE 'Batch 2: Deleted records older than 14 days';
END $$;

-- Batch 3: Delete records older than 7 days (final cleanup)
DO $$
BEGIN
  DELETE FROM waqi_data
  WHERE timestamp < NOW() - INTERVAL '7 days';
  RAISE NOTICE 'Batch 3: Deleted records older than 7 days';
END $$;

-- Check remaining records
SELECT
    '✅ Deletion complete' as status,
    COUNT(*) as remaining_records,
    MIN(timestamp) as oldest_record,
    MAX(timestamp) as newest_record
FROM waqi_data;

SELECT '💡 If this step completes successfully, proceed to the next script' as next_step;
SELECT 'Run: cleanup-remove-aqi-column.sql' as next_script;
