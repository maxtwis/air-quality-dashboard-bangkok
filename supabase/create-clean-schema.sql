-- Clean Schema for Bangkok Air Quality Dashboard
-- Stores both WAQI and Google supplement data in a single unified table
-- Run this in Supabase SQL Editor

-- Create main air quality data table
CREATE TABLE IF NOT EXISTS public.air_quality_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Station location
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    station_name TEXT,

    -- AQI
    aqi INTEGER,

    -- Pollutant concentrations (μg/m³)
    pm25 DECIMAL(8, 2),
    pm10 DECIMAL(8, 2),
    o3 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),
    so2 DECIMAL(8, 2),
    co DECIMAL(8, 2),

    -- Data source tracking
    data_source VARCHAR(20) DEFAULT 'WAQI',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_aqdata_station_timestamp
ON public.air_quality_data(station_uid, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_aqdata_timestamp
ON public.air_quality_data(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_aqdata_source
ON public.air_quality_data(data_source);

-- Enable Row Level Security
ALTER TABLE public.air_quality_data ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.air_quality_data
    FOR SELECT USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to insert" ON public.air_quality_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role to update" ON public.air_quality_data
    FOR UPDATE USING (true);

-- Create view for latest readings per station
CREATE OR REPLACE VIEW latest_readings AS
SELECT DISTINCT ON (station_uid)
    station_uid,
    timestamp,
    lat,
    lon,
    station_name,
    aqi,
    pm25,
    pm10,
    o3,
    no2,
    so2,
    co,
    data_source
FROM public.air_quality_data
ORDER BY station_uid, timestamp DESC;

-- Create view for 3-hour moving averages
CREATE OR REPLACE VIEW air_quality_3h_averages AS
SELECT
    station_uid,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading,
    -- Count readings by source
    COUNT(CASE WHEN data_source = 'WAQI' THEN 1 END) as waqi_count,
    COUNT(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN 1 END) as google_count
FROM public.air_quality_data
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Create function to clean old data (keep last 7 days)
CREATE OR REPLACE FUNCTION clean_old_air_quality_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.air_quality_data
    WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE public.air_quality_data IS
'Unified table storing air quality data from both WAQI and Google Air Quality API';

COMMENT ON COLUMN public.air_quality_data.data_source IS
'Source of data: WAQI (primary) or GOOGLE_SUPPLEMENT (O3/NO2 supplements)';

COMMENT ON VIEW latest_readings IS
'Latest reading for each station, combining WAQI and Google data';

COMMENT ON VIEW air_quality_3h_averages IS
'3-hour moving averages of all pollutants for AQHI calculations';

-- Verify table was created
SELECT
    'Schema created successfully!' as status,
    COUNT(*) as current_readings
FROM public.air_quality_data;
