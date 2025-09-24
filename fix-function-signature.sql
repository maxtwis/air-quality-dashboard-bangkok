-- Fix function signature error
-- Run this before the main openweather-station-matching.sql

-- Drop the existing function with the old signature
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages(VARCHAR, DECIMAL, DECIMAL);

-- Also drop any other variations that might exist
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages(character varying, numeric, numeric);
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages;

SELECT 'Old functions dropped, now you can run openweather-station-matching.sql' as message;