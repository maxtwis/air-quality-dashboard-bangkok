-- Create fresh table for Google Air Quality supplements
-- Run this in Supabase SQL Editor

-- Create google_supplements table
CREATE TABLE IF NOT EXISTS public.google_supplements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Google pollutant data (μg/m³)
    o3 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),

    -- Metadata
    grid_lat DECIMAL(10, 7),  -- Which grid point this came from
    grid_lon DECIMAL(10, 7),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_station_timestamp
ON public.google_supplements(station_uid, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_google_timestamp
ON public.google_supplements(timestamp DESC);

-- Enable Row Level Security (optional, for security)
ALTER TABLE public.google_supplements ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON public.google_supplements
    FOR SELECT USING (true);

-- Create policy to allow service role to insert
CREATE POLICY "Allow service role to insert" ON public.google_supplements
    FOR INSERT WITH CHECK (true);

-- Create view for latest Google supplements per station
CREATE OR REPLACE VIEW latest_google_supplements AS
SELECT DISTINCT ON (station_uid)
    station_uid,
    timestamp,
    o3,
    no2,
    grid_lat,
    grid_lon
FROM public.google_supplements
ORDER BY station_uid, timestamp DESC;

-- Create view for 3-hour average Google supplements
CREATE OR REPLACE VIEW google_3h_averages AS
SELECT
    station_uid,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading
FROM public.google_supplements
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Add helpful comments
COMMENT ON TABLE public.google_supplements IS
'Stores O3 and NO2 supplements from Google Air Quality API for stations missing these pollutants';

COMMENT ON COLUMN public.google_supplements.station_uid IS
'WAQI station UID that this supplement data is for';

COMMENT ON COLUMN public.google_supplements.grid_lat IS
'Latitude of the 3x3 grid point this data came from';

COMMENT ON COLUMN public.google_supplements.grid_lon IS
'Longitude of the 3x3 grid point this data came from';

-- Verify table was created
SELECT
    'Table created successfully!' as status,
    COUNT(*) as current_supplements
FROM public.google_supplements;
