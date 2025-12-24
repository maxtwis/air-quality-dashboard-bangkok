-- Air Quality Dashboard - Clean Up Old Records
-- This script provides options to reduce database size by deleting old records
-- Current: 1,434,245 records (~684 MB)

-- OPTION 1: Keep only last 7 days of data (recommended for free tier)
-- This should reduce to ~10,000-15,000 records (~5-7 MB)

BEGIN;

-- Check how many records we have in different time ranges
SELECT
    'Last 24 hours' as period,
    COUNT(*) as record_count,
    MIN(timestamp) as oldest,
    MAX(timestamp) as newest
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Last 7 days' as period,
    COUNT(*) as record_count,
    MIN(timestamp) as oldest,
    MAX(timestamp) as newest
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT
    'Last 30 days' as period,
    COUNT(*) as record_count,
    MIN(timestamp) as oldest,
    MAX(timestamp) as newest
FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '30 days'
UNION ALL
SELECT
    'Total (all time)' as period,
    COUNT(*) as record_count,
    MIN(timestamp) as oldest,
    MAX(timestamp) as newest
FROM waqi_data;

-- UNCOMMENT ONE OF THE FOLLOWING DELETE STATEMENTS BASED ON YOUR NEEDS:

-- Option A: Keep only last 7 days (recommended for AQHI calculations)
-- DELETE FROM waqi_data WHERE timestamp < NOW() - INTERVAL '7 days';

-- Option B: Keep only last 24 hours (minimal storage)
-- DELETE FROM waqi_data WHERE timestamp < NOW() - INTERVAL '24 hours';

-- Option C: Keep only last 30 days (if you need more history)
-- DELETE FROM waqi_data WHERE timestamp < NOW() - INTERVAL '30 days';

-- After deletion, reclaim space
-- VACUUM ANALYZE waqi_data;

ROLLBACK; -- Change to COMMIT after uncommenting your chosen DELETE statement

-- Instructions:
-- 1. Review the record counts above
-- 2. Uncomment your chosen DELETE statement
-- 3. Change ROLLBACK to COMMIT
-- 4. Run this script in Supabase SQL Editor
