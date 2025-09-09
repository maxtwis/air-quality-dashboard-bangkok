-- Fix Row Level Security policies for Supabase
-- This allows inserts from authenticated service role and anon users for testing

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON public.air_quality_readings;
DROP POLICY IF EXISTS "Allow public read access" ON public.stations;

-- Stations table policies
CREATE POLICY "Enable read access for all users" ON public.stations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.stations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.stations
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for testing" ON public.stations
    FOR DELETE USING (uid = 99999); -- Only allow deleting test station

-- Air quality readings table policies
CREATE POLICY "Enable read access for all users" ON public.air_quality_readings
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.air_quality_readings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.air_quality_readings
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for testing" ON public.air_quality_readings
    FOR DELETE USING (station_uid = 99999); -- Only allow deleting test data

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies updated successfully!';
    RAISE NOTICE '📝 Now allows INSERT operations for data collection';
    RAISE NOTICE '🔒 Test data (station_uid=99999) can be deleted';
END $$;