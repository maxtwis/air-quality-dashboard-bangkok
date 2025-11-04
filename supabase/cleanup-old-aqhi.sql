-- =============================================================================
-- CLEANUP OLD AQHI SYSTEM
-- Run this BEFORE running google-aqhi-system.sql
-- This removes all old WAQI+Google combined AQHI tables
-- =============================================================================

-- Drop old AQHI tables (if they exist)
DROP TABLE IF EXISTS public.aqhi_hourly_calculated CASCADE;
DROP TABLE IF EXISTS public.air_quality_readings CASCADE;
DROP TABLE IF EXISTS public.stations CASCADE;

-- Drop old views
DROP VIEW IF EXISTS current_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_station_readings CASCADE;
DROP VIEW IF EXISTS combined_3h_averages CASCADE;
DROP VIEW IF EXISTS waqi_3h_averages CASCADE;
DROP VIEW IF EXISTS google_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_waqi_readings CASCADE;
DROP VIEW IF EXISTS latest_google_supplements CASCADE;
DROP VIEW IF EXISTS latest_combined_readings CASCADE;
DROP VIEW IF EXISTS latest_aqhi_by_station CASCADE;
DROP VIEW IF EXISTS aqhi_3h_averages CASCADE;
DROP VIEW IF EXISTS aqhi_24h_history CASCADE;
DROP VIEW IF EXISTS aqhi_7day_history CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS calculate_aqhi CASCADE;
DROP FUNCTION IF EXISTS calculate_thai_aqhi CASCADE;
DROP FUNCTION IF EXISTS calculate_thai_aqhi_v2 CASCADE;
DROP FUNCTION IF EXISTS calculate_thai_aqhi_from_mixed_sources CASCADE;
DROP FUNCTION IF EXISTS aqi_to_concentration_o3 CASCADE;
DROP FUNCTION IF EXISTS aqi_to_concentration_no2 CASCADE;
DROP FUNCTION IF EXISTS get_aqhi_category CASCADE;
DROP FUNCTION IF EXISTS calculate_and_store_hourly_aqhi CASCADE;
DROP FUNCTION IF EXISTS calculate_and_store_hourly_aqhi_v2 CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_aqhi_data CASCADE;
DROP FUNCTION IF EXISTS update_station_timestamp CASCADE;

-- Drop old triggers
DROP TRIGGER IF EXISTS trigger_update_station_timestamp ON public.air_quality_readings CASCADE;

-- KEEP WAQI data tables (for AQI display)
-- DO NOT DROP:
-- - public.waqi_data (used for AQI tab)
-- - public.google_supplements (if still collecting)

-- Verify cleanup
SELECT
    'Old AQHI tables cleaned up!' as status,
    'Ready to run google-aqhi-system.sql' as next_step;

-- Show remaining tables
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
