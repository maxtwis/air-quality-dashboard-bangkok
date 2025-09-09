-- Supabase schema for Bangkok Air Quality Dashboard (FIXED VERSION)
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if needed (comment out if you want to preserve data)
-- DROP TABLE IF EXISTS public.air_quality_readings CASCADE;
-- DROP TABLE IF EXISTS public.stations CASCADE;
-- DROP TABLE IF EXISTS public.moving_averages_3h CASCADE;

-- Main table for storing air quality readings
CREATE TABLE IF NOT EXISTS public.air_quality_readings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    aqi INTEGER,
    
    -- Pollutant concentrations (μg/m³)
    pm25 DECIMAL(8, 2) DEFAULT 0,
    pm10 DECIMAL(8, 2) DEFAULT 0,
    no2 DECIMAL(8, 2) DEFAULT 0,
    o3 DECIMAL(8, 2) DEFAULT 0,
    so2 DECIMAL(8, 2) DEFAULT 0,
    co DECIMAL(8, 2) DEFAULT 0,
    
    -- Station metadata
    station_name TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_aqr_station_timestamp 
    ON public.air_quality_readings(station_uid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_aqr_timestamp 
    ON public.air_quality_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_aqr_station_uid 
    ON public.air_quality_readings(station_uid);

-- Table for station metadata
CREATE TABLE IF NOT EXISTS public.stations (
    uid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    city TEXT DEFAULT 'Bangkok',
    country TEXT DEFAULT 'Thailand',
    
    -- Sensor capabilities
    has_pm25 BOOLEAN DEFAULT FALSE,
    has_pm10 BOOLEAN DEFAULT FALSE,
    has_no2 BOOLEAN DEFAULT FALSE,
    has_o3 BOOLEAN DEFAULT FALSE,
    has_so2 BOOLEAN DEFAULT FALSE,
    has_co BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    reading_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to calculate AQHI
CREATE OR REPLACE FUNCTION public.calculate_aqhi(
    pm25_val DECIMAL DEFAULT 0,
    no2_val DECIMAL DEFAULT 0,
    o3_val DECIMAL DEFAULT 0,
    so2_val DECIMAL DEFAULT 0
) RETURNS DECIMAL 
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    pm25_component DECIMAL;
    no2_component DECIMAL;
    o3_component DECIMAL;
    so2_component DECIMAL;
    aqhi_result DECIMAL;
BEGIN
    -- Ensure non-null and non-negative values
    pm25_val := GREATEST(0, COALESCE(pm25_val, 0));
    no2_val := GREATEST(0, COALESCE(no2_val, 0));
    o3_val := GREATEST(0, COALESCE(o3_val, 0));
    so2_val := GREATEST(0, COALESCE(so2_val, 0));
    
    -- AQHI formula components
    pm25_component := 100 * (EXP(0.0012 * pm25_val) - 1);
    no2_component := EXP(0.0052 * no2_val) - 1;
    o3_component := EXP(0.001 * o3_val) - 1;
    so2_component := EXP(0.0038 * so2_val) - 1;
    
    -- Calculate final AQHI
    aqhi_result := (10.0 / 105.19) * (pm25_component + no2_component + o3_component + so2_component);
    
    -- Round to 1 decimal place
    RETURN ROUND(aqhi_result, 1);
END;
$$;

-- Function to get AQHI level
CREATE OR REPLACE FUNCTION public.get_aqhi_level(aqhi_value DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF aqhi_value IS NULL THEN
        RETURN 'UNKNOWN';
    ELSIF aqhi_value <= 3 THEN
        RETURN 'LOW';
    ELSIF aqhi_value <= 6 THEN
        RETURN 'MODERATE';
    ELSIF aqhi_value <= 10 THEN
        RETURN 'HIGH';
    ELSE
        RETURN 'VERY_HIGH';
    END IF;
END;
$$;

-- View for current 3-hour averages (simplified version)
CREATE OR REPLACE VIEW public.current_3h_averages AS
SELECT 
    r.station_uid,
    MAX(s.name) as station_name,
    MAX(s.lat) as lat,
    MAX(s.lon) as lon,
    MAX(s.city) as city,
    
    -- Calculate averages
    ROUND(AVG(CASE WHEN r.pm25 > 0 THEN r.pm25 ELSE NULL END)::numeric, 2) as pm25_3h_avg,
    ROUND(AVG(CASE WHEN r.no2 > 0 THEN r.no2 ELSE NULL END)::numeric, 2) as no2_3h_avg,
    ROUND(AVG(CASE WHEN r.o3 > 0 THEN r.o3 ELSE NULL END)::numeric, 2) as o3_3h_avg,
    ROUND(AVG(CASE WHEN r.so2 > 0 THEN r.so2 ELSE NULL END)::numeric, 2) as so2_3h_avg,
    
    -- Calculate AQHI
    public.calculate_aqhi(
        AVG(CASE WHEN r.pm25 > 0 THEN r.pm25 ELSE NULL END),
        AVG(CASE WHEN r.no2 > 0 THEN r.no2 ELSE NULL END),
        AVG(CASE WHEN r.o3 > 0 THEN r.o3 ELSE NULL END),
        AVG(CASE WHEN r.so2 > 0 THEN r.so2 ELSE NULL END)
    ) as aqhi,
    
    -- Data quality
    COUNT(*) as reading_count,
    MIN(r.timestamp) as oldest_reading,
    MAX(r.timestamp) as newest_reading
    
FROM public.air_quality_readings r
LEFT JOIN public.stations s ON r.station_uid = s.uid
WHERE r.timestamp >= (CURRENT_TIMESTAMP - INTERVAL '3 hours')
GROUP BY r.station_uid;

-- Enable Row Level Security
ALTER TABLE public.air_quality_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
DROP POLICY IF EXISTS "Allow public read access" ON public.air_quality_readings;
CREATE POLICY "Allow public read access" ON public.air_quality_readings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.stations;
CREATE POLICY "Allow public read access" ON public.stations
    FOR SELECT USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON public.current_3h_averages TO anon;

-- Test the setup with sample data
DO $$
BEGIN
    -- Insert a test station (will be replaced by real data)
    INSERT INTO public.stations (uid, name, lat, lon, city)
    VALUES (99999, 'Test Station', 13.7563, 100.5018, 'Bangkok')
    ON CONFLICT (uid) DO NOTHING;
    
    -- Insert a test reading
    INSERT INTO public.air_quality_readings 
        (station_uid, timestamp, lat, lon, aqi, pm25, no2, o3, so2, station_name)
    VALUES 
        (99999, NOW(), 13.7563, 100.5018, 85, 35.5, 25.2, 45.8, 15.3, 'Test Station');
    
    RAISE NOTICE 'Test data inserted successfully';
    
    -- Clean up test data after verification
    DELETE FROM public.air_quality_readings WHERE station_uid = 99999;
    DELETE FROM public.stations WHERE uid = 99999;
    
    RAISE NOTICE 'Test data cleaned up';
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Supabase schema setup complete!';
    RAISE NOTICE '📊 Tables created: air_quality_readings, stations';
    RAISE NOTICE '🔧 Functions created: calculate_aqhi, get_aqhi_level';
    RAISE NOTICE '👁️ View created: current_3h_averages';
    RAISE NOTICE '🔒 Row Level Security enabled with public read access';
END $$;