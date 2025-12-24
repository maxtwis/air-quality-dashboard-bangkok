-- Reclaim Disk Space - Step by Step Instructions
-- Run each section SEPARATELY in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Check current table size (Run this first)
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
-- STEP 2: Run VACUUM FULL (Run this ALONE in a new query)
-- ============================================================================

-- Copy ONLY this line and run it separately:

VACUUM FULL waqi_data;

-- ============================================================================
-- STEP 3: Verify space reclaimed (Run this after VACUUM FULL completes)
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
-- STEP 4: Analyze table (Run this last)
-- ============================================================================

-- Copy ONLY this line and run it separately:

ANALYZE waqi_data;

-- Done! Expected result: ~10-15 MB (was ~504 MB)
