-- =============================================================================
-- GOOGLE-ONLY AQHI SYSTEM FOR BANGKOK
-- 15 Fixed Community Monitoring Points
-- Clean separation: AQI (WAQI) | AQHI (Google only)
-- =============================================================================

-- Drop old tables if they exist
DROP TABLE IF EXISTS public.aqhi_hourly_calculated CASCADE;
DROP TABLE IF EXISTS public.google_aqhi_hourly CASCADE;
DROP VIEW IF EXISTS latest_aqhi_by_location CASCADE;
DROP VIEW IF EXISTS aqhi_3h_averages CASCADE;
DROP VIEW IF EXISTS aqhi_24h_history CASCADE;
DROP VIEW IF EXISTS aqhi_7day_history CASCADE;

-- =============================================================================
-- TABLE 1: Community Monitoring Locations (15 fixed points)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.community_locations (
    id SERIAL PRIMARY KEY,
    location_id INTEGER UNIQUE NOT NULL,  -- 1-15
    location_name TEXT NOT NULL,
    district_th TEXT,
    district_en TEXT,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    population INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert 15 community locations from community_point.csv
INSERT INTO public.community_locations (location_id, location_name, district_th, district_en, latitude, longitude, population) VALUES
(1, 'มัสยยิดบ้านตึกดิน', 'พระนคร', 'Phra Nakhon', 13.758108, 100.500366, 265),
(2, 'หลังศูนย์จันทร์ฉิมไพบูลย์', 'ธนบุรี', 'Thonburi', 13.720943, 100.481581, 612),
(3, 'ปลายซอยศักดิ์เจริญ', 'บางกอกใหญ่', 'Bangkok Yai', 13.733446, 100.463527, 261),
(4, 'ซอยท่าดินแดง 14 และ 16', 'คลองสาน', 'Khlong San', 13.735493, 100.504763, 2147),
(5, 'วัดไชยทิศ', 'บางกอกน้อย', 'Bangkok Noi', 13.768083, 100.463323, 1615),
(6, 'รักเจริญ', 'หนองแขม', 'Nong Khaem', 13.716707, 100.355342, 596),
(7, 'หมู่ 7 ราษฎร์บูรณะ', 'ราษฎร์บูรณะ', 'Rat Burana', 13.66671, 100.515025, 1390),
(8, 'ชุมชนสวัสดี', 'ดินแดง', 'Din Daeng', 13.772018, 100.558131, 840),
(9, 'สาหร่ายทองคำ', 'พระโขนง', 'Phra Khanong', 13.701217, 100.612882, 482),
(10, 'นันทวันเซ็นต์ 2', 'หนองจอก', 'Nong Chok', 13.845409, 100.88052, NULL),
(11, 'ซอยพระเจน', 'ปทุมวัน', 'Pathum Wan', 13.731048, 100.546676, 5007),
(12, 'มัสยิดมหานาค', 'ป้อมปราบศัตรูพ่าย', 'Pom Prap', 13.752959, 100.515871, 924),
(13, 'ชุมชนสะพานหัน', 'สัมพันธวงศ์', 'Samphanthawong', 13.74281, 100.502217, 297),
(14, 'บ้านมั่นคงฟ้าใหม่', 'บางพลัด', 'Bang Phlat', 13.79493179, 100.5014054, 299),
(15, 'บ่อฝรั่งริมน้ำ', 'จตุจักร', 'Chatuchak', 13.82163586, 100.5425091, 1035)
ON CONFLICT (location_id) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_community_locations_id ON public.community_locations(location_id);

-- =============================================================================
-- TABLE 2: Google AQHI Hourly Data
-- Stores hourly readings from Google Air Quality API
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.google_aqhi_hourly (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES public.community_locations(location_id),

    -- Hourly timestamp (always at :00 minutes, e.g., 08:00, 09:00, 10:00)
    hour_timestamp TIMESTAMPTZ NOT NULL,

    -- Pollutant concentrations from Google (all in ppb)
    pm25 DECIMAL(8, 2),      -- μg/m³
    pm10 DECIMAL(8, 2),      -- μg/m³
    o3 DECIMAL(8, 2),        -- ppb
    no2 DECIMAL(8, 2),       -- ppb
    so2 DECIMAL(8, 2),       -- ppb
    co DECIMAL(8, 2),        -- ppb

    -- Quality indicators
    data_quality TEXT,       -- EXCELLENT, GOOD, FAIR, LIMITED

    -- 3-hour rolling averages (calculated by Supabase)
    pm25_3h_avg DECIMAL(8, 2),
    pm10_3h_avg DECIMAL(8, 2),
    o3_3h_avg DECIMAL(8, 2),
    no2_3h_avg DECIMAL(8, 2),

    -- Calculated AQHI (using 3-hour averages)
    aqhi DECIMAL(4, 1),
    aqhi_category TEXT,      -- LOW, MODERATE, HIGH, VERY_HIGH

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure no duplicates for same location and hour
    UNIQUE(location_id, hour_timestamp)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_aqhi_location_time ON public.google_aqhi_hourly(location_id, hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_google_aqhi_timestamp ON public.google_aqhi_hourly(hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_google_aqhi_category ON public.google_aqhi_hourly(aqhi_category);

-- =============================================================================
-- FUNCTION: calculate_thai_aqhi (Google ppb values only)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_thai_aqhi(
    pm25_val DECIMAL,  -- μg/m³
    pm10_val DECIMAL,  -- μg/m³
    o3_val DECIMAL,    -- ppb
    no2_val DECIMAL    -- ppb
) RETURNS DECIMAL AS $$
DECLARE
    C CONSTANT DECIMAL := 105.19;
    beta_pm25 CONSTANT DECIMAL := 0.0022;  -- for μg/m³
    beta_pm10 CONSTANT DECIMAL := 0.0009;  -- for μg/m³
    beta_o3 CONSTANT DECIMAL := 0.001;     -- for ppb
    beta_no2 CONSTANT DECIMAL := 0.003;    -- for ppb

    per_er_pm25 DECIMAL := 0;
    per_er_pm10 DECIMAL := 0;
    per_er_o3 DECIMAL := 0;
    per_er_no2 DECIMAL := 0;
    total_per_er DECIMAL;
    aqhi_value DECIMAL;
BEGIN
    -- Calculate Percentage Excess Risk for each pollutant
    IF pm25_val IS NOT NULL AND pm25_val > 0 THEN
        per_er_pm25 := 100 * (EXP(beta_pm25 * pm25_val) - 1);
    END IF;

    IF pm10_val IS NOT NULL AND pm10_val > 0 THEN
        per_er_pm10 := 100 * (EXP(beta_pm10 * pm10_val) - 1);
    END IF;

    IF o3_val IS NOT NULL AND o3_val > 0 THEN
        per_er_o3 := 100 * (EXP(beta_o3 * o3_val) - 1);
    END IF;

    IF no2_val IS NOT NULL AND no2_val > 0 THEN
        per_er_no2 := 100 * (EXP(beta_no2 * no2_val) - 1);
    END IF;

    -- Total Percentage Excess Risk
    total_per_er := per_er_pm25 + per_er_pm10 + per_er_o3 + per_er_no2;

    -- Calculate AQHI
    aqhi_value := (10.0 / C) * total_per_er;

    -- Round to 1 decimal and ensure minimum of 1
    RETURN GREATEST(ROUND(aqhi_value, 1), 1.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: get_aqhi_category
-- =============================================================================

CREATE OR REPLACE FUNCTION get_aqhi_category(aqhi_val DECIMAL)
RETURNS TEXT AS $$
BEGIN
    IF aqhi_val < 4 THEN RETURN 'LOW';
    ELSIF aqhi_val < 7 THEN RETURN 'MODERATE';
    ELSIF aqhi_val < 10 THEN RETURN 'HIGH';
    ELSE RETURN 'VERY_HIGH';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: calculate_3h_averages_and_aqhi
-- Called after inserting new hourly data
-- Calculates 3-hour rolling averages and AQHI for the current hour
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_3h_averages_and_aqhi(target_location_id INTEGER, target_hour TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE
    avg_pm25 DECIMAL;
    avg_pm10 DECIMAL;
    avg_o3 DECIMAL;
    avg_no2 DECIMAL;
    calculated_aqhi DECIMAL;
    aqhi_cat TEXT;
BEGIN
    -- Calculate 3-hour rolling averages
    -- For 08:00, average of 06:00, 07:00, 08:00
    SELECT
        AVG(pm25),
        AVG(pm10),
        AVG(o3),
        AVG(no2)
    INTO avg_pm25, avg_pm10, avg_o3, avg_no2
    FROM public.google_aqhi_hourly
    WHERE location_id = target_location_id
        AND hour_timestamp >= target_hour - INTERVAL '2 hours'
        AND hour_timestamp <= target_hour
    HAVING COUNT(*) >= 1;  -- At least 1 reading

    -- Calculate AQHI from averages
    IF avg_pm25 IS NOT NULL OR avg_o3 IS NOT NULL THEN
        calculated_aqhi := calculate_thai_aqhi(
            COALESCE(avg_pm25, 0),
            COALESCE(avg_pm10, 0),
            COALESCE(avg_o3, 0),
            COALESCE(avg_no2, 0)
        );
        aqhi_cat := get_aqhi_category(calculated_aqhi);

        -- Update the current hour record with 3h averages and AQHI
        UPDATE public.google_aqhi_hourly
        SET
            pm25_3h_avg = avg_pm25,
            pm10_3h_avg = avg_pm10,
            o3_3h_avg = avg_o3,
            no2_3h_avg = avg_no2,
            aqhi = calculated_aqhi,
            aqhi_category = aqhi_cat
        WHERE location_id = target_location_id
            AND hour_timestamp = target_hour;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: update_all_3h_averages
-- Recalculates 3-hour averages for all recent records
-- =============================================================================

CREATE OR REPLACE FUNCTION update_all_3h_averages()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- Update last 24 hours of data
    FOR rec IN
        SELECT DISTINCT location_id, hour_timestamp
        FROM public.google_aqhi_hourly
        WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY hour_timestamp DESC
    LOOP
        PERFORM calculate_3h_averages_and_aqhi(rec.location_id, rec.hour_timestamp);
        updated_count := updated_count + 1;
    END LOOP;

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS FOR EASY ACCESS
-- =============================================================================

-- View 1: Latest AQHI for each location
CREATE OR REPLACE VIEW latest_aqhi_by_location AS
SELECT DISTINCT ON (g.location_id)
    g.location_id,
    c.location_name,
    c.district_th,
    c.latitude,
    c.longitude,
    g.hour_timestamp,
    g.aqhi,
    g.aqhi_category,
    g.pm25_3h_avg,
    g.pm10_3h_avg,
    g.o3_3h_avg,
    g.no2_3h_avg,
    g.data_quality
FROM public.google_aqhi_hourly g
JOIN public.community_locations c ON g.location_id = c.location_id
ORDER BY g.location_id, g.hour_timestamp DESC;

-- View 2: 24-hour history for charts
CREATE OR REPLACE VIEW aqhi_24h_history AS
SELECT
    g.location_id,
    c.location_name,
    g.hour_timestamp,
    g.aqhi,
    g.aqhi_category,
    g.pm25_3h_avg,
    g.pm10_3h_avg,
    g.o3_3h_avg,
    g.no2_3h_avg
FROM public.google_aqhi_hourly g
JOIN public.community_locations c ON g.location_id = c.location_id
WHERE g.hour_timestamp >= NOW() - INTERVAL '24 hours'
    AND g.aqhi IS NOT NULL
ORDER BY g.location_id, g.hour_timestamp DESC;

-- View 3: 7-day history for long-term charts
CREATE OR REPLACE VIEW aqhi_7day_history AS
SELECT
    g.location_id,
    c.location_name,
    g.hour_timestamp,
    g.aqhi,
    g.aqhi_category,
    g.pm25_3h_avg,
    g.pm10_3h_avg,
    g.o3_3h_avg,
    g.no2_3h_avg
FROM public.google_aqhi_hourly g
JOIN public.community_locations c ON g.location_id = c.location_id
WHERE g.hour_timestamp >= NOW() - INTERVAL '7 days'
    AND g.aqhi IS NOT NULL
ORDER BY g.location_id, g.hour_timestamp DESC;

-- =============================================================================
-- CLEANUP FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_google_aqhi_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.google_aqhi_hourly
    WHERE hour_timestamp < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % old Google AQHI records', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.community_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_aqhi_hourly ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read community_locations" ON public.community_locations FOR SELECT USING (true);
CREATE POLICY "Allow public read google_aqhi" ON public.google_aqhi_hourly FOR SELECT USING (true);

-- Allow service role to write
CREATE POLICY "Allow service write community_locations" ON public.community_locations FOR ALL USING (true);
CREATE POLICY "Allow service write google_aqhi" ON public.google_aqhi_hourly FOR ALL USING (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.community_locations IS
'15 fixed community monitoring points in Bangkok for AQHI measurements';

COMMENT ON TABLE public.google_aqhi_hourly IS
'Hourly Google Air Quality API data with 3-hour rolling averages and calculated AQHI';

COMMENT ON COLUMN public.google_aqhi_hourly.hour_timestamp IS
'Hourly timestamp rounded to :00 minutes (e.g., 08:00, 09:00, 10:00)';

COMMENT ON COLUMN public.google_aqhi_hourly.pm25_3h_avg IS
'3-hour rolling average: average of current hour + 2 previous hours';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
    'Google AQHI System Created!' as status,
    (SELECT COUNT(*) FROM public.community_locations) as total_locations,
    (SELECT COUNT(*) FROM public.google_aqhi_hourly) as total_hourly_readings;

SELECT * FROM public.community_locations ORDER BY location_id;
