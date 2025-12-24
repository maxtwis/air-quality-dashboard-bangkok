-- Reclaim Disk Space from Deleted Records
-- This script uses VACUUM FULL to physically reclaim disk space
-- WARNING: This operation requires an exclusive lock on the table
-- It may take several minutes to complete

-- ============================================================================
-- STEP 1: Check current table size
-- ============================================================================

SELECT
    '📊 BEFORE VACUUM FULL' as status,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS total_size,
    pg_size_pretty(pg_relation_size('waqi_data')) AS table_size,
    pg_size_pretty(pg_indexes_size('waqi_data')) AS index_size;

SELECT
    'Current record count:' as info,
    COUNT(*) as records
FROM waqi_data;

-- ============================================================================
-- STEP 2: Run VACUUM FULL to reclaim space
-- ============================================================================

-- This command will:
-- 1. Rewrite the entire table to reclaim space
-- 2. Rebuild all indexes
-- 3. Return unused space to the operating system
-- Note: Requires exclusive lock, may take 5-10 minutes

VACUUM FULL waqi_data;

-- ============================================================================
-- STEP 3: Verify space reclaimed
-- ============================================================================

SELECT
    '📊 AFTER VACUUM FULL' as status,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS total_size,
    pg_size_pretty(pg_relation_size('waqi_data')) AS table_size,
    pg_size_pretty(pg_indexes_size('waqi_data')) AS index_size;

SELECT
    'Final record count:' as info,
    COUNT(*) as records
FROM waqi_data;

-- ============================================================================
-- STEP 4: Analyze table for query optimization
-- ============================================================================

ANALYZE waqi_data;

SELECT '✅ Space reclamation complete!' as status;
SELECT '💡 Expected size: ~10-15 MB (was ~504 MB)' as result;
