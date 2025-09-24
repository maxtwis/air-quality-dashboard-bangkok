-- OpenWeather API Integration Enhancement
-- Add support for storing OpenWeather data for stations missing O3/NO2
-- Run this in Supabase SQL Editor

-- New table for storing OpenWeather air pollution data
CREATE TABLE IF NOT EXISTS public.openweather_readings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- OpenWeather pollutant data (μg/m³)
    pm25 DECIMAL(8, 2),
    pm10 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),
    o3 DECIMAL(8, 2),
    so2 DECIMAL(8, 2),
    co DECIMAL(8, 3), -- mg/m³ for CO

    -- Metadata
    api_source TEXT DEFAULT 'openweather',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_openweather_lat_lon_timestamp
    ON public.openweather_readings(lat, lon, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_openweather_timestamp
    ON public.openweather_readings(timestamp DESC);

-- Add columns to track OpenWeather usage in existing air_quality_readings
ALTER TABLE public.air_quality_readings
ADD COLUMN IF NOT EXISTS openweather_no2 DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS openweather_o3 DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS data_source_flags TEXT DEFAULT 'station'; -- 'station', 'mixed', 'openweather'

-- Function to get nearby OpenWeather data for a station
CREATE OR REPLACE FUNCTION get_nearby_openweather_data(
    station_lat DECIMAL(10, 7),
    station_lon DECIMAL(10, 7),
    time_window_hours INTEGER DEFAULT 3
)
RETURNS TABLE(
    avg_no2 DECIMAL(8, 2),
    avg_o3 DECIMAL(8, 2),
    avg_pm25 DECIMAL(8, 2),
    avg_so2 DECIMAL(8, 2),
    reading_count INTEGER
) AS $$
DECLARE
    lat_tolerance DECIMAL := 0.01; -- ~1km tolerance
    lon_tolerance DECIMAL := 0.01;
BEGIN
    RETURN QUERY
    SELECT
        AVG(no2)::DECIMAL(8, 2) as avg_no2,
        AVG(o3)::DECIMAL(8, 2) as avg_o3,
        AVG(pm25)::DECIMAL(8, 2) as avg_pm25,
        AVG(so2)::DECIMAL(8, 2) as avg_so2,
        COUNT(*)::INTEGER as reading_count
    FROM public.openweather_readings
    WHERE lat BETWEEN station_lat - lat_tolerance AND station_lat + lat_tolerance
      AND lon BETWEEN station_lon - lon_tolerance AND station_lon + lon_tolerance
      AND timestamp >= NOW() - INTERVAL '1 hour' * time_window_hours
      AND (no2 IS NOT NULL OR o3 IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Enhanced function for calculating 3-hour averages with OpenWeather fallback
CREATE OR REPLACE FUNCTION calculate_enhanced_3h_averages(
    station_uid_param INTEGER,
    station_lat DECIMAL(10, 7),
    station_lon DECIMAL(10, 7)
)
RETURNS TABLE(
    pm25 DECIMAL(8, 2),
    pm10 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),
    o3 DECIMAL(8, 2),
    so2 DECIMAL(8, 2),
    co DECIMAL(8, 2),
    reading_count INTEGER,
    data_sources TEXT
) AS $$
DECLARE
    station_data RECORD;
    openweather_data RECORD;
    sources TEXT := 'station';
BEGIN
    -- Get station data (3-hour average)
    SELECT
        AVG(aqr.pm25)::DECIMAL(8, 2) as avg_pm25,
        AVG(aqr.pm10)::DECIMAL(8, 2) as avg_pm10,
        AVG(aqr.no2)::DECIMAL(8, 2) as avg_no2,
        AVG(aqr.o3)::DECIMAL(8, 2) as avg_o3,
        AVG(aqr.so2)::DECIMAL(8, 2) as avg_so2,
        AVG(aqr.co)::DECIMAL(8, 2) as avg_co,
        COUNT(*)::INTEGER as count
    INTO station_data
    FROM public.air_quality_readings aqr
    WHERE aqr.station_uid = station_uid_param
      AND aqr.timestamp >= NOW() - INTERVAL '3 hours'
      AND (aqr.pm25 > 0 OR aqr.no2 > 0 OR aqr.o3 > 0);

    -- If missing NO2 or O3, get OpenWeather data
    IF (station_data.avg_no2 IS NULL OR station_data.avg_o3 IS NULL) THEN
        SELECT * INTO openweather_data
        FROM get_nearby_openweather_data(station_lat, station_lon, 3);

        -- Merge data sources
        IF openweather_data.reading_count > 0 THEN
            sources := 'mixed';

            RETURN QUERY SELECT
                COALESCE(station_data.avg_pm25, openweather_data.avg_pm25) as pm25,
                station_data.avg_pm10 as pm10,
                COALESCE(station_data.avg_no2, openweather_data.avg_no2) as no2,
                COALESCE(station_data.avg_o3, openweather_data.avg_o3) as o3,
                COALESCE(station_data.avg_so2, openweather_data.avg_so2) as so2,
                station_data.avg_co as co,
                GREATEST(COALESCE(station_data.count, 0), openweather_data.reading_count) as reading_count,
                sources as data_sources;
            RETURN;
        END IF;
    END IF;

    -- Return station-only data
    RETURN QUERY SELECT
        station_data.avg_pm25 as pm25,
        station_data.avg_pm10 as pm10,
        station_data.avg_no2 as no2,
        station_data.avg_o3 as o3,
        station_data.avg_so2 as so2,
        station_data.avg_co as co,
        COALESCE(station_data.count, 0) as reading_count,
        sources as data_sources;
END;
$$ LANGUAGE plpgsql;

-- Function to track and limit OpenWeather API usage
CREATE TABLE IF NOT EXISTS public.openweather_api_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    api_calls INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

-- Function to check and increment API usage
CREATE OR REPLACE FUNCTION check_and_increment_api_usage()
RETURNS BOOLEAN AS $$
DECLARE
    current_usage INTEGER := 0;
    max_daily_calls INTEGER := 950; -- Leave buffer under 1000
BEGIN
    -- Get current usage for today
    SELECT api_calls INTO current_usage
    FROM public.openweather_api_usage
    WHERE date = CURRENT_DATE;

    -- If no record exists, create one
    IF current_usage IS NULL THEN
        INSERT INTO public.openweather_api_usage (date, api_calls)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (date) DO UPDATE SET
            api_calls = 1,
            updated_at = NOW();
        RETURN TRUE;
    END IF;

    -- Check if under limit
    IF current_usage < max_daily_calls THEN
        UPDATE public.openweather_api_usage
        SET api_calls = api_calls + 1,
            updated_at = NOW()
        WHERE date = CURRENT_DATE;
        RETURN TRUE;
    END IF;

    -- Over limit
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get current API usage stats
CREATE OR REPLACE FUNCTION get_api_usage_stats()
RETURNS TABLE(
    date DATE,
    calls_used INTEGER,
    calls_remaining INTEGER,
    percentage_used DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.date,
        u.api_calls as calls_used,
        (1000 - u.api_calls) as calls_remaining,
        ROUND((u.api_calls::DECIMAL / 1000) * 100, 2) as percentage_used
    FROM public.openweather_api_usage u
    WHERE u.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old OpenWeather data (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_openweather_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.openweather_readings
    WHERE timestamp < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Also cleanup old API usage records (keep 30 days)
    DELETE FROM public.openweather_api_usage
    WHERE date < CURRENT_DATE - INTERVAL '30 days';

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE public.openweather_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openweather_api_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access on openweather_readings" ON public.openweather_readings
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on openweather_readings" ON public.openweather_readings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on openweather_api_usage" ON public.openweather_api_usage
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update access on openweather_api_usage" ON public.openweather_api_usage
    FOR ALL WITH CHECK (true);

-- Create scheduled job to cleanup old data (if pg_cron is available)
-- SELECT cron.schedule('cleanup-openweather-data', '0 2 * * *', 'SELECT cleanup_old_openweather_data();');