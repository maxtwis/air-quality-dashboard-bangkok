-- Remove AQI column from waqi_data table only
-- Fixed version - only operates on tables that exist

-- Drop AQI-related indexes if they exist
DROP INDEX IF EXISTS idx_waqi_aqi;
DROP INDEX IF EXISTS idx_readings_aqi;

-- Drop AQI column from waqi_data
ALTER TABLE waqi_data DROP COLUMN IF EXISTS aqi;

-- Verify AQI column is gone
SELECT
    'AQI columns remaining:' as check,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'waqi_data'
AND column_name = 'aqi';

-- Show final table structure
SELECT
    'waqi_data columns:' as info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'waqi_data'
ORDER BY ordinal_position;

-- Show table size after cleanup
SELECT
    'Table size:' as metric,
    pg_size_pretty(pg_total_relation_size('waqi_data')) AS total_size,
    pg_size_pretty(pg_relation_size('waqi_data')) AS data_size,
    pg_size_pretty(pg_indexes_size('waqi_data')) AS index_size;

-- Success message
SELECT '✅ AQI column removed successfully!' as status;
SELECT '💡 Run VACUUM ANALYZE waqi_data; to reclaim space (optional)' as tip;
