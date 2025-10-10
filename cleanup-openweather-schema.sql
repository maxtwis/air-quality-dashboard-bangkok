-- Cleanup Script: Remove OpenWeather Tables and Functions from Supabase
-- Run this in your Supabase SQL Editor to remove all OpenWeather-related database objects

-- Drop views that depend on OpenWeather tables
DROP VIEW IF EXISTS current_openweather_station_3h_averages CASCADE;

-- Drop the OpenWeather readings table
DROP TABLE IF EXISTS openweather_readings CASCADE;

-- Drop the API usage tracking table (only used for OpenWeather)
DROP TABLE IF EXISTS api_usage CASCADE;

-- Drop OpenWeather-related functions
DROP FUNCTION IF EXISTS cleanup_old_openweather_data() CASCADE;
DROP FUNCTION IF EXISTS get_api_usage_stats() CASCADE;
DROP FUNCTION IF EXISTS check_and_increment_api_usage() CASCADE;

-- Verify cleanup
SELECT 'OpenWeather tables and functions removed successfully!' as message;

-- Show remaining tables (should only see stations and air_quality_readings)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
