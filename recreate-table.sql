-- Alternative: Recreate table to reclaim space (if VACUUM FULL times out)
-- This creates a new table with only recent data, then swaps them

-- ============================================================================
-- STEP 1: Create new table with recent data only
-- ============================================================================

CREATE TABLE waqi_data_new AS
SELECT * FROM waqi_data
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- STEP 2: Verify new table
-- ============================================================================

SELECT
    'New table record count:' as info,
    COUNT(*) as records
FROM waqi_data_new;

SELECT
    'New table size:' as info,
    pg_size_pretty(pg_total_relation_size('waqi_data_new')) AS size
FROM waqi_data_new
LIMIT 1;

-- ============================================================================
-- STEP 3: Swap tables (CAREFUL!)
-- ============================================================================

BEGIN;

-- Rename old table
ALTER TABLE waqi_data RENAME TO waqi_data_old;

-- Rename new table to original name
ALTER TABLE waqi_data_new RENAME TO waqi_data;

-- Recreate indexes on new table
CREATE INDEX IF NOT EXISTS idx_waqi_timestamp ON waqi_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_waqi_station_uid ON waqi_data(station_uid);
CREATE INDEX IF NOT EXISTS idx_waqi_station_time ON waqi_data(station_uid, timestamp DESC);

COMMIT;

-- ============================================================================
-- STEP 4: Verify swap was successful
-- ============================================================================

SELECT
    'Current waqi_data:' as table_name,
    COUNT(*) as records,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS size
FROM waqi_data;

-- ============================================================================
-- STEP 5: Drop old table (only after verifying everything works!)
-- ============================================================================

-- UNCOMMENT AFTER VERIFYING THE NEW TABLE WORKS:
-- DROP TABLE waqi_data_old;

SELECT '✅ Table recreated!' as status;
SELECT '⚠️  Old table still exists as waqi_data_old' as warning;
SELECT '💡 Test the app, then run: DROP TABLE waqi_data_old;' as next_step;
