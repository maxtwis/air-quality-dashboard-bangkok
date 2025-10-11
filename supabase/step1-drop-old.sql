-- STEP 1: Drop all old tables, views, and functions
-- Run this FIRST before creating new schema

-- Drop all views
DROP VIEW IF EXISTS current_3h_averages CASCADE;
DROP VIEW IF EXISTS current_3h_averages_detailed CASCADE;
DROP VIEW IF EXISTS current_3h_averages_by_source CASCADE;
DROP VIEW IF EXISTS latest_station_readings CASCADE;
DROP VIEW IF EXISTS latest_google_supplements CASCADE;
DROP VIEW IF EXISTS google_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_readings CASCADE;
DROP VIEW IF EXISTS air_quality_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_waqi_readings CASCADE;
DROP VIEW IF EXISTS latest_combined_readings CASCADE;
DROP VIEW IF EXISTS waqi_3h_averages CASCADE;
DROP VIEW IF EXISTS combined_3h_averages CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;
DROP FUNCTION IF EXISTS clean_old_air_quality_data() CASCADE;
DROP FUNCTION IF EXISTS calculate_aqhi(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;

-- Drop all tables
DROP TABLE IF EXISTS google_supplements CASCADE;
DROP TABLE IF EXISTS air_quality_readings CASCADE;
DROP TABLE IF EXISTS air_quality_data CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS waqi_data CASCADE;

-- Verify everything is dropped
SELECT 'All old tables, views, and functions dropped successfully!' as status;

-- Check remaining tables (should be empty or system tables only)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
