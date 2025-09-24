-- Fix function signature error with CASCADE
-- Run this before the main openweather-station-matching.sql

-- Drop the dependent view first
DROP VIEW IF EXISTS current_aqhi_ready_stations CASCADE;

-- Drop the existing function with all variations
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages(VARCHAR, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages(character varying, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages CASCADE;

SELECT 'Old functions and dependent views dropped successfully!' as message;
SELECT 'Now you can run openweather-station-matching.sql' as next_step;