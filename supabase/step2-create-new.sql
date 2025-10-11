-- STEP 2: Create fresh schema
-- Run this AFTER step1-drop-old.sql completes successfully

-- =============================================================================
-- TABLE 1: WAQI Data (PM2.5, PM10, SO2, CO)
-- =============================================================================

CREATE TABLE public.waqi_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Station info
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    station_name TEXT,
    city TEXT DEFAULT 'Bangkok',

    -- AQI
    aqi INTEGER,

    -- Pollutants from WAQI (μg/m³)
    pm25 DECIMAL(8, 2),
    pm10 DECIMAL(8, 2),
    so2 DECIMAL(8, 2),
    co DECIMAL(8, 2),

    -- Sometimes WAQI has these too (rare)
    o3 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for WAQI data
CREATE INDEX idx_waqi_station_timestamp ON public.waqi_data(station_uid, timestamp DESC);
CREATE INDEX idx_waqi_timestamp ON public.waqi_data(timestamp DESC);
CREATE INDEX idx_waqi_station_uid ON public.waqi_data(station_uid);

-- =============================================================================
-- TABLE 2: Google Supplements (O3, NO2)
-- =============================================================================

CREATE TABLE public.google_supplements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_uid INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Google pollutants (μg/m³)
    o3 DECIMAL(8, 2),
    no2 DECIMAL(8, 2),

    -- Which grid point this came from
    grid_lat DECIMAL(10, 7),
    grid_lon DECIMAL(10, 7),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Google supplements
CREATE INDEX idx_google_station_timestamp ON public.google_supplements(station_uid, timestamp DESC);
CREATE INDEX idx_google_timestamp ON public.google_supplements(timestamp DESC);
CREATE INDEX idx_google_station_uid ON public.google_supplements(station_uid);

-- =============================================================================
-- VIEWS FOR EASY QUERYING
-- =============================================================================

-- View 1: Latest WAQI reading per station
CREATE VIEW latest_waqi_readings AS
SELECT DISTINCT ON (station_uid)
    station_uid,
    timestamp,
    lat,
    lon,
    station_name,
    aqi,
    pm25,
    pm10,
    so2,
    co,
    o3,
    no2
FROM public.waqi_data
ORDER BY station_uid, timestamp DESC;

-- View 2: Latest Google supplement per station
CREATE VIEW latest_google_supplements AS
SELECT DISTINCT ON (station_uid)
    station_uid,
    timestamp,
    o3,
    no2,
    grid_lat,
    grid_lon
FROM public.google_supplements
ORDER BY station_uid, timestamp DESC;

-- View 3: Combined latest readings (WAQI + Google)
CREATE VIEW latest_combined_readings AS
SELECT
    w.station_uid,
    w.timestamp as waqi_timestamp,
    w.lat,
    w.lon,
    w.station_name,
    w.aqi,
    -- WAQI pollutants
    w.pm25,
    w.pm10,
    w.so2,
    w.co,
    -- O3/NO2: Use Google if available, otherwise WAQI
    COALESCE(g.o3, w.o3) as o3,
    COALESCE(g.no2, w.no2) as no2,
    -- Track sources
    CASE WHEN g.o3 IS NOT NULL THEN 'GOOGLE' ELSE 'WAQI' END as o3_source,
    CASE WHEN g.no2 IS NOT NULL THEN 'GOOGLE' ELSE 'WAQI' END as no2_source,
    g.timestamp as google_timestamp
FROM latest_waqi_readings w
LEFT JOIN latest_google_supplements g ON w.station_uid = g.station_uid;

-- View 4: WAQI 3-hour averages
CREATE VIEW waqi_3h_averages AS
SELECT
    station_uid,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading
FROM public.waqi_data
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- View 5: Google 3-hour averages
CREATE VIEW google_3h_averages AS
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

-- View 6: COMBINED 3-hour averages (FOR AQHI CALCULATION)
CREATE VIEW combined_3h_averages AS
SELECT
    w.station_uid,
    -- WAQI averages (typically 9 readings per 3 hours)
    w.avg_pm25,
    w.avg_pm10,
    w.avg_so2,
    w.avg_co,
    -- O3/NO2: Use Google if available (typically 3 readings per 3 hours)
    COALESCE(g.avg_o3, w.avg_o3) as avg_o3,
    COALESCE(g.avg_no2, w.avg_no2) as avg_no2,
    -- Reading counts
    w.reading_count as waqi_readings,
    g.reading_count as google_readings,
    -- Timestamps
    w.latest_reading as waqi_latest,
    g.latest_reading as google_latest,
    -- Data quality indicators
    CASE WHEN g.reading_count >= 3 THEN 'EXCELLENT'
         WHEN g.reading_count >= 2 THEN 'GOOD'
         WHEN g.reading_count >= 1 THEN 'FAIR'
         ELSE 'LIMITED' END as data_quality
FROM waqi_3h_averages w
LEFT JOIN google_3h_averages g ON w.station_uid = g.station_uid;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.waqi_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_supplements ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read WAQI" ON public.waqi_data
    FOR SELECT USING (true);

CREATE POLICY "Allow public read Google" ON public.google_supplements
    FOR SELECT USING (true);

-- Allow service role to insert
CREATE POLICY "Allow service insert WAQI" ON public.waqi_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service insert Google" ON public.google_supplements
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- CLEANUP FUNCTION (Keep last 7 days)
-- =============================================================================

CREATE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.waqi_data
    WHERE timestamp < NOW() - INTERVAL '7 days';

    DELETE FROM public.google_supplements
    WHERE timestamp < NOW() - INTERVAL '7 days';

    RAISE NOTICE 'Cleaned up data older than 7 days';
END;
$$;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.waqi_data IS
'WAQI station data collected every 20 minutes (PM2.5, PM10, SO2, CO)';

COMMENT ON TABLE public.google_supplements IS
'Google Air Quality API supplements collected every 60 minutes (O3, NO2 only)';

COMMENT ON VIEW combined_3h_averages IS
'Combined 3-hour moving averages from WAQI + Google for AQHI calculations';

COMMENT ON COLUMN public.google_supplements.station_uid IS
'WAQI station UID that this supplement is matched to (via nearest grid point)';

COMMENT ON COLUMN public.google_supplements.grid_lat IS
'Latitude of 3x3 grid point where this O3/NO2 data was fetched from';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
    'Fresh schema created successfully!' as status,
    (SELECT COUNT(*) FROM public.waqi_data) as waqi_records,
    (SELECT COUNT(*) FROM public.google_supplements) as google_records;
