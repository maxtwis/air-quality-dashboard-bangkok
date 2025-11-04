-- ============================================================================
-- Automatic AQHI Calculation Trigger
-- ============================================================================
-- This trigger automatically calculates AQHI when new data is inserted
-- into google_aqhi_hourly table, making the collection endpoint fast
-- ============================================================================

-- Function to automatically calculate AQHI for new data
CREATE OR REPLACE FUNCTION auto_calculate_aqhi_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the existing AQHI calculation function for this location and hour
  PERFORM calculate_3h_averages_and_aqhi(
    target_location_id := NEW.location_id,
    target_hour := NEW.hour_timestamp
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_calculate_aqhi ON public.google_aqhi_hourly;

-- Create trigger that fires after each insert
CREATE TRIGGER trigger_auto_calculate_aqhi
  AFTER INSERT ON public.google_aqhi_hourly
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_aqhi_on_insert();

-- ============================================================================
-- How this works:
-- ============================================================================
-- 1. Collection endpoint inserts raw data into google_aqhi_hourly
-- 2. Trigger automatically fires and calculates AQHI
-- 3. No need for separate AQHI calculation endpoint
-- 4. Collection endpoint completes in ~5 seconds (within Vercel free tier)
-- ============================================================================

-- Test the trigger (optional - uncomment to test)
-- INSERT INTO google_aqhi_hourly (location_id, hour_timestamp, pm25, o3, no2)
-- VALUES (1, NOW(), 25.5, 45.2, 20.1)
-- ON CONFLICT (location_id, hour_timestamp) DO UPDATE
-- SET pm25 = EXCLUDED.pm25;

-- Check if AQHI was calculated
-- SELECT location_id, hour_timestamp, aqhi, aqhi_category
-- FROM google_aqhi_hourly
-- WHERE location_id = 1
-- ORDER BY hour_timestamp DESC
-- LIMIT 1;
