-- Supabase schema for Bangkok Air Quality Dashboard
-- Optimized for PostgreSQL with Row Level Security

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Indexes for performance (Supabase optimized)
CREATE INDEX IF NOT EXISTS idx_aqr_station_timestamp ON public.air_quality_readings(station_uid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_aqr_timestamp ON public.air_quality_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_aqr_station_uid ON public.air_quality_readings(station_uid);
-- Note: Removed partial index with NOW() as it's not IMMUTABLE

-- Table for station metadata
CREATE TABLE IF NOT EXISTS public.stations (
    uid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    city TEXT DEFAULT 'Bangkok',
    country TEXT DEFAULT 'Thailand',
    
    -- Sensor capabilities (automatically detected)
    has_pm25 BOOLEAN DEFAULT FALSE,
    has_pm10 BOOLEAN DEFAULT FALSE,
    has_no2 BOOLEAN DEFAULT FALSE,
    has_o3 BOOLEAN DEFAULT FALSE,
    has_so2 BOOLEAN DEFAULT FALSE,
    has_co BOOLEAN DEFAULT FALSE,
    
    -- Status tracking
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    reading_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-calculated 3-hour moving averages (for performance)
CREATE TABLE IF NOT EXISTS public.moving_averages_3h (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    calculation_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 3-hour averages
    pm25_avg DECIMAL(8, 2),
    pm10_avg DECIMAL(8, 2),
    no2_avg DECIMAL(8, 2),
    o3_avg DECIMAL(8, 2),
    so2_avg DECIMAL(8, 2),
    co_avg DECIMAL(8, 2),
    
    -- AQHI calculation
    aqhi DECIMAL(4, 1),
    aqhi_level TEXT, -- 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'
    
    -- Data quality metrics
    data_points INTEGER DEFAULT 0,
    completeness_ratio DECIMAL(3, 2) DEFAULT 0, -- 0.0 to 1.0
    time_span_hours DECIMAL(3, 1) DEFAULT 3.0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ma_station_calc_time ON public.moving_averages_3h(station_uid, calculation_time DESC);
CREATE INDEX IF NOT EXISTS idx_ma_calc_time ON public.moving_averages_3h(calculation_time DESC);

-- Function to calculate AQHI (Supabase compatible)
CREATE OR REPLACE FUNCTION public.calculate_aqhi(
    pm25_val DECIMAL DEFAULT 0,
    no2_val DECIMAL DEFAULT 0,
    o3_val DECIMAL DEFAULT 0,
    so2_val DECIMAL DEFAULT 0
) RETURNS DECIMAL 
LANGUAGE plpgsql
AS $$
DECLARE
    pm25_component DECIMAL;
    no2_component DECIMAL;
    o3_component DECIMAL;
    so2_component DECIMAL;
    aqhi_result DECIMAL;
BEGIN
    -- Ensure non-null values
    pm25_val := COALESCE(pm25_val, 0);
    no2_val := COALESCE(no2_val, 0);
    o3_val := COALESCE(o3_val, 0);
    so2_val := COALESCE(so2_val, 0);
    
    -- AQHI formula components using Thai Health Department coefficients
    -- β coefficients: PM2.5: 0.0012, PM10: 0.0012, NO₂: 0.0052, O₃: 0.0010
    pm25_component := 100 * (EXP(0.0012 * pm25_val) - 1);
    no2_component := 100 * (EXP(0.0052 * no2_val) - 1);
    o3_component := 100 * (EXP(0.0010 * o3_val) - 1);
    so2_component := 100 * (EXP(0.0 * so2_val) - 1);

    -- Calculate final AQHI: (10/C) * Total %ER
    aqhi_result := (10.0 / 105.19) * (pm25_component + no2_component + o3_component + so2_component);
    
    -- Round to 1 decimal place
    RETURN ROUND(aqhi_result, 1);
END;
$$;

-- Function to get AQHI level
CREATE OR REPLACE FUNCTION public.get_aqhi_level(aqhi_value DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    IF aqhi_value <= 3 THEN
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

-- View for current 3-hour averages
CREATE OR REPLACE VIEW public.current_3h_averages AS
SELECT 
    r.station_uid,
    s.name as station_name,
    s.lat,
    s.lon,
    s.city,
    
    -- Calculate 3-hour averages (only non-zero values)
    ROUND(AVG(NULLIF(r.pm25, 0))::numeric, 2) as pm25_3h_avg,
    ROUND(AVG(NULLIF(r.no2, 0))::numeric, 2) as no2_3h_avg,
    ROUND(AVG(NULLIF(r.o3, 0))::numeric, 2) as o3_3h_avg,
    ROUND(AVG(NULLIF(r.so2, 0))::numeric, 2) as so2_3h_avg,
    ROUND(AVG(NULLIF(r.pm10, 0))::numeric, 2) as pm10_3h_avg,
    ROUND(AVG(NULLIF(r.co, 0))::numeric, 2) as co_3h_avg,
    
    -- AQHI calculation
    public.calculate_aqhi(
        AVG(NULLIF(r.pm25, 0)),
        AVG(NULLIF(r.no2, 0)),
        AVG(NULLIF(r.o3, 0)),
        AVG(NULLIF(r.so2, 0))
    ) as aqhi,
    
    public.get_aqhi_level(
        public.calculate_aqhi(
            AVG(NULLIF(r.pm25, 0)),
            AVG(NULLIF(r.no2, 0)),
            AVG(NULLIF(r.o3, 0)),
            AVG(NULLIF(r.so2, 0))
        )
    ) as aqhi_level,
    
    -- Data quality metrics
    COUNT(*) as reading_count,
    ROUND(EXTRACT(EPOCH FROM (MAX(r.timestamp) - MIN(r.timestamp))) / 3600.0, 1) as actual_time_span_hours,
    MIN(r.timestamp) as oldest_reading,
    MAX(r.timestamp) as newest_reading,
    
    -- Current readings (most recent)
    (SELECT pm25 FROM public.air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_pm25,
    (SELECT no2 FROM public.air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_no2,
    (SELECT o3 FROM public.air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_o3,
    (SELECT so2 FROM public.air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_so2,
    (SELECT aqi FROM public.air_quality_readings WHERE station_uid = r.station_uid ORDER BY timestamp DESC LIMIT 1) as current_aqi,
    
    -- Sensor availability
    s.has_pm25,
    s.has_no2,
    s.has_o3,
    s.has_so2

FROM public.air_quality_readings r
JOIN public.stations s ON r.station_uid = s.uid
WHERE r.timestamp >= NOW() - INTERVAL '3 hours'
  AND s.is_active = TRUE
GROUP BY r.station_uid, s.name, s.lat, s.lon, s.city, s.has_pm25, s.has_no2, s.has_o3, s.has_so2
HAVING COUNT(*) >= 3; -- At least 3 readings for meaningful average

-- Trigger to update station metadata when new readings arrive
CREATE OR REPLACE FUNCTION public.update_station_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert or update station info
    INSERT INTO public.stations (uid, name, lat, lon, last_seen, reading_count, has_pm25, has_no2, has_o3, has_so2, has_pm10, has_co)
    VALUES (
        NEW.station_uid,
        COALESCE(NEW.station_name, 'Unknown Station'),
        NEW.lat,
        NEW.lon,
        NEW.timestamp,
        1,
        NEW.pm25 > 0,
        NEW.no2 > 0,
        NEW.o3 > 0,
        NEW.so2 > 0,
        NEW.pm10 > 0,
        NEW.co > 0
    )
    ON CONFLICT (uid) DO UPDATE SET
        name = COALESCE(NEW.station_name, stations.name),
        lat = NEW.lat,
        lon = NEW.lon,
        last_seen = NEW.timestamp,
        reading_count = stations.reading_count + 1,
        has_pm25 = stations.has_pm25 OR (NEW.pm25 > 0),
        has_no2 = stations.has_no2 OR (NEW.no2 > 0),
        has_o3 = stations.has_o3 OR (NEW.o3 > 0),
        has_so2 = stations.has_so2 OR (NEW.so2 > 0),
        has_pm10 = stations.has_pm10 OR (NEW.pm10 > 0),
        has_co = stations.has_co OR (NEW.co > 0),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS update_station_metadata_trigger ON public.air_quality_readings;
CREATE TRIGGER update_station_metadata_trigger
    AFTER INSERT ON public.air_quality_readings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_station_metadata();

-- Function to cleanup old data (keep 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete readings older than 7 days
    DELETE FROM public.air_quality_readings 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old moving averages
    DELETE FROM public.moving_averages_3h 
    WHERE calculation_time < NOW() - INTERVAL '7 days';
    
    -- Mark stations as inactive if no recent readings
    UPDATE public.stations 
    SET is_active = FALSE 
    WHERE last_seen < NOW() - INTERVAL '24 hours';
    
    RETURN deleted_count;
END;
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.air_quality_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moving_averages_3h ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow public read access, restrict write to service role)
CREATE POLICY "Allow public read access to air quality readings" ON public.air_quality_readings
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to stations" ON public.stations
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to moving averages" ON public.moving_averages_3h
    FOR SELECT USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.air_quality_readings TO anon;
GRANT SELECT ON public.stations TO anon;
GRANT SELECT ON public.moving_averages_3h TO anon;
GRANT SELECT ON public.current_3h_averages TO anon;

GRANT SELECT ON public.air_quality_readings TO authenticated;
GRANT SELECT ON public.stations TO authenticated;
GRANT SELECT ON public.moving_averages_3h TO authenticated;
GRANT SELECT ON public.current_3h_averages TO authenticated;

-- For service role (used by Edge Functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;