-- Ultra-Batched Cleanup - For Maximum Compatibility with Supabase Timeout Limits
-- Run each DELETE statement ONE AT A TIME in Supabase SQL Editor
-- Wait for each to complete before running the next one

-- ============================================================================
-- CURRENT STATE CHECK
-- ============================================================================

SELECT 'Total records:' as info, COUNT(*) as count FROM waqi_data;

SELECT 'Records in last 7 days:' as info, COUNT(*) as count
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- DELETE IN SMALL BATCHES - RUN ONE AT A TIME
-- ============================================================================

-- Batch 1: Delete records older than 60 days (oldest data first)
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '60 days';

-- After batch 1 completes, run this to check progress:
-- SELECT 'After batch 1:' as info, COUNT(*) as remaining FROM waqi_data;

-- Batch 2: Delete records 30-60 days old
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '30 days'
AND timestamp >= NOW() - INTERVAL '60 days';

-- Check progress:
-- SELECT 'After batch 2:' as info, COUNT(*) as remaining FROM waqi_data;

-- Batch 3: Delete records 21-30 days old
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '21 days'
AND timestamp >= NOW() - INTERVAL '30 days';

-- Batch 4: Delete records 14-21 days old
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '14 days'
AND timestamp >= NOW() - INTERVAL '21 days';

-- Batch 5: Delete records 10-14 days old
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '10 days'
AND timestamp >= NOW() - INTERVAL '14 days';

-- Batch 6: Delete records 7-10 days old (final cleanup)
DELETE FROM waqi_data
WHERE timestamp < NOW() - INTERVAL '7 days'
AND timestamp >= NOW() - INTERVAL '10 days';

-- ============================================================================
-- FINAL CHECK
-- ============================================================================

SELECT
    '✅ Cleanup complete!' as status,
    COUNT(*) as total_records,
    MIN(timestamp) as oldest_record,
    MAX(timestamp) as newest_record
FROM waqi_data;

SELECT 'Next step: Run cleanup-remove-aqi-column.sql' as next_action;
