-- Update Supabase Schema for Google Supplements
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Step 1: Add data_source column if it doesn't exist
ALTER TABLE air_quality_readings
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'WAQI';

-- Step 2: Drop old constraint if exists
ALTER TABLE air_quality_readings
DROP CONSTRAINT IF EXISTS check_data_source;

-- Step 3: Add new constraint to support GOOGLE_SUPPLEMENT
ALTER TABLE air_quality_readings
ADD CONSTRAINT check_data_source
CHECK (data_source IN ('WAQI', 'GOOGLE', 'GOOGLE_SUPPLEMENT'));

-- Step 4: Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_readings_data_source
ON air_quality_readings(data_source);

-- Step 5: Create index for timestamp + data_source (for 3-hour queries)
CREATE INDEX IF NOT EXISTS idx_readings_timestamp_source
ON air_quality_readings(timestamp DESC, data_source);

-- Step 6: Update 3-hour averages view to combine WAQI and Google supplements
DROP VIEW IF EXISTS current_3h_averages CASCADE;

CREATE VIEW current_3h_averages AS
SELECT
    station_uid,
    -- Average all pollutants across both WAQI and GOOGLE_SUPPLEMENT readings
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    -- Count total readings
    COUNT(*) as reading_count,
    -- Count by source
    COUNT(CASE WHEN data_source = 'WAQI' THEN 1 END) as waqi_count,
    COUNT(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN 1 END) as google_count,
    -- Latest and earliest readings
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Step 7: Create a detailed view showing data sources
CREATE OR REPLACE VIEW current_3h_averages_detailed AS
SELECT
    station_uid,
    -- WAQI pollutants (PM2.5, PM10 from WAQI readings only)
    AVG(CASE WHEN data_source = 'WAQI' THEN pm25 END) as waqi_pm25,
    AVG(CASE WHEN data_source = 'WAQI' THEN pm10 END) as waqi_pm10,
    AVG(CASE WHEN data_source = 'WAQI' THEN so2 END) as waqi_so2,
    AVG(CASE WHEN data_source = 'WAQI' THEN co END) as waqi_co,
    -- Google supplements (O3, NO2 from Google readings only)
    AVG(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN o3 END) as google_o3,
    AVG(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN no2 END) as google_no2,
    -- Combined (for AQHI calculation - use Google O3/NO2 if available)
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    COALESCE(
        AVG(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN o3 END),
        AVG(CASE WHEN data_source = 'WAQI' THEN o3 END)
    ) as avg_o3,
    COALESCE(
        AVG(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN no2 END),
        AVG(CASE WHEN data_source = 'WAQI' THEN no2 END)
    ) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    -- Reading counts
    COUNT(CASE WHEN data_source = 'WAQI' THEN 1 END) as waqi_count,
    COUNT(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN 1 END) as google_count,
    COUNT(*) as total_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN air_quality_readings.data_source IS
'Source of the data: WAQI (primary), GOOGLE_SUPPLEMENT (O3/NO2 supplements)';

COMMENT ON VIEW current_3h_averages IS
'3-hour moving averages combining WAQI and Google supplement data';

COMMENT ON VIEW current_3h_averages_detailed IS
'Detailed 3-hour averages showing separate WAQI and Google values';

-- Step 9: Verify the schema
SELECT
    'Schema updated successfully!' as status,
    COUNT(*) as total_readings,
    COUNT(CASE WHEN data_source = 'WAQI' THEN 1 END) as waqi_readings,
    COUNT(CASE WHEN data_source = 'GOOGLE_SUPPLEMENT' THEN 1 END) as google_readings,
    MAX(timestamp) as latest_reading
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '24 hours';
