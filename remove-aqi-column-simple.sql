-- Simple script to remove AQI column from waqi_data table
-- This should be fast since the table is now smaller (153K records instead of 1.4M)

-- Drop AQI-related indexes
DROP INDEX IF EXISTS idx_waqi_aqi;
DROP INDEX IF EXISTS idx_readings_aqi;

-- Drop AQI column from waqi_data
ALTER TABLE waqi_data DROP COLUMN IF EXISTS aqi;

-- Drop AQI column from air_quality_readings (if exists)
ALTER TABLE air_quality_readings DROP COLUMN IF EXISTS aqi;

-- Verify AQI column is gone
SELECT
    'AQI columns remaining:' as check,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('waqi_data', 'air_quality_readings')
AND column_name = 'aqi';

-- Show final table structure
SELECT
    'waqi_data columns:' as table_info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'waqi_data'
ORDER BY ordinal_position;
