-- =============================================================================
-- CLEANUP EXISTING TABLES
-- Based on your current Supabase schema
-- Run this BEFORE google-aqhi-system.sql
-- =============================================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS combined_3h_averages CASCADE;
DROP VIEW IF EXISTS google_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_combined_readings CASCADE;
DROP VIEW IF EXISTS latest_google_supplements CASCADE;
DROP VIEW IF EXISTS latest_waqi_readings CASCADE;
DROP VIEW IF EXISTS waqi_3h_averages CASCADE;

-- Drop the google_supplements table
-- (This was used for old WAQI+Google combined AQHI)
DROP TABLE IF EXISTS google_supplements CASCADE;

-- KEEP these tables (needed for AQI tab):
-- ✅ waqi_data - WAQI station data for AQI display

-- Verify what's left
SELECT
    'Cleanup complete!' as status,
    'Old AQHI views and google_supplements table removed' as message;

-- Show remaining tables
SELECT
    schemaname,
    tablename,
    CASE
        WHEN tablename = 'waqi_data' THEN '✅ Keep - Used for AQI tab'
        ELSE '📋 Table'
    END as notes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Ready to create new Google-only AQHI system
SELECT 'Ready to run: google-aqhi-system.sql' as next_step;
