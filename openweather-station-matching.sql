-- OpenWeather Station Matching Integration
-- Adds station_uid to openweather_readings and creates proper station-to-station matching
-- Run this in your Supabase SQL Editor

-- 1. Add station_uid column to openweather_readings table
ALTER TABLE public.openweather_readings
ADD COLUMN IF NOT EXISTS station_uid VARCHAR(50);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_openweather_station_uid_timestamp
ON public.openweather_readings(station_uid, timestamp DESC);

-- 2. Create function to find nearest station for given coordinates
CREATE OR REPLACE FUNCTION find_nearest_station(
    target_lat DECIMAL(10, 7),
    target_lon DECIMAL(10, 7),
    max_distance_km DECIMAL DEFAULT 10.0
)
RETURNS VARCHAR(50) AS $$
DECLARE
    nearest_station VARCHAR(50);
    min_distance DECIMAL;
BEGIN
    SELECT
        s.station_uid,
        (6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(target_lat - s.latitude) / 2), 2) +
            COS(RADIANS(target_lat)) * COS(RADIANS(s.latitude)) *
            POWER(SIN(RADIANS(target_lon - s.longitude) / 2), 2)
        ))) as distance_km
    INTO nearest_station, min_distance
    FROM stations s
    WHERE s.is_active = true
    ORDER BY distance_km
    LIMIT 1;

    -- Only return if within acceptable distance
    IF min_distance <= max_distance_km THEN
        RETURN nearest_station;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Update existing OpenWeather readings to match them with stations
UPDATE public.openweather_readings
SET station_uid = find_nearest_station(lat, lon, 10.0)
WHERE station_uid IS NULL;

-- 4. Create view for current 3-hour averages per station (OpenWeather)
CREATE OR REPLACE VIEW current_openweather_station_3h_averages AS
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
    AVG(lat) as avg_lat,
    AVG(lon) as avg_lon,
    -- Calculate average distance from station
    AVG(6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS((SELECT latitude FROM stations WHERE station_uid = ow.station_uid) - ow.lat) / 2), 2) +
        COS(RADIANS((SELECT latitude FROM stations WHERE station_uid = ow.station_uid))) * COS(RADIANS(ow.lat)) *
        POWER(SIN(RADIANS((SELECT longitude FROM stations WHERE station_uid = ow.station_uid) - ow.lon) / 2), 2)
    ))) as avg_distance_km
FROM openweather_readings ow
WHERE timestamp >= NOW() - INTERVAL '3 hours'
  AND station_uid IS NOT NULL
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- 5. Simplified and improved calculate_enhanced_3h_averages function
CREATE OR REPLACE FUNCTION calculate_enhanced_3h_averages(
    station_uid_param VARCHAR(50),
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
    data_sources TEXT,
    openweather_readings INTEGER,
    aqicn_readings INTEGER
) AS $$
DECLARE
    aqicn_data RECORD;
    openweather_data RECORD;
    sources TEXT := 'aqicn';
    aqicn_count INTEGER := 0;
    openweather_count INTEGER := 0;
BEGIN
    -- Get AQICN station data (3-hour average)
    SELECT
        AVG(aqr.pm25)::DECIMAL(8, 2) as avg_pm25,
        AVG(aqr.pm10)::DECIMAL(8, 2) as avg_pm10,
        AVG(aqr.no2)::DECIMAL(8, 2) as avg_no2,
        AVG(aqr.o3)::DECIMAL(8, 2) as avg_o3,
        AVG(aqr.so2)::DECIMAL(8, 2) as avg_so2,
        AVG(aqr.co)::DECIMAL(8, 2) as avg_co,
        COUNT(*)::INTEGER as count
    INTO aqicn_data
    FROM air_quality_readings aqr
    WHERE aqr.station_uid = station_uid_param
      AND aqr.timestamp >= NOW() - INTERVAL '3 hours'
      AND (aqr.pm25 > 0 OR aqr.no2 > 0 OR aqr.o3 > 0);

    aqicn_count := COALESCE(aqicn_data.count, 0);

    -- Get OpenWeather data for the same station
    SELECT
        avg_pm25,
        avg_pm10,
        avg_no2,
        avg_o3,
        avg_so2,
        avg_co,
        reading_count
    INTO openweather_data
    FROM current_openweather_station_3h_averages
    WHERE station_uid = station_uid_param;

    openweather_count := COALESCE(openweather_data.reading_count, 0);

    -- Determine data sources and merge logic
    IF aqicn_count > 0 AND openweather_count > 0 THEN
        -- Both data sources available - merge intelligently
        sources := 'mixed';

        RETURN QUERY SELECT
            -- Prefer AQICN PM2.5 (station data), fallback to OpenWeather
            COALESCE(aqicn_data.avg_pm25, openweather_data.avg_pm25) as pm25,
            COALESCE(aqicn_data.avg_pm10, openweather_data.avg_pm10) as pm10,
            -- Use OpenWeather NO2/O3 if AQICN missing, otherwise prefer AQICN
            COALESCE(aqicn_data.avg_no2, openweather_data.avg_no2) as no2,
            COALESCE(aqicn_data.avg_o3, openweather_data.avg_o3) as o3,
            COALESCE(aqicn_data.avg_so2, openweather_data.avg_so2) as so2,
            COALESCE(aqicn_data.avg_co, openweather_data.avg_co) as co,
            GREATEST(aqicn_count, openweather_count) as reading_count,
            sources as data_sources,
            openweather_count as openweather_readings,
            aqicn_count as aqicn_readings;
    ELSIF aqicn_count > 0 THEN
        -- Only AQICN data available
        RETURN QUERY SELECT
            aqicn_data.avg_pm25 as pm25,
            aqicn_data.avg_pm10 as pm10,
            aqicn_data.avg_no2 as no2,
            aqicn_data.avg_o3 as o3,
            aqicn_data.avg_so2 as so2,
            aqicn_data.avg_co as co,
            aqicn_count as reading_count,
            'aqicn'::TEXT as data_sources,
            0 as openweather_readings,
            aqicn_count as aqicn_readings;
    ELSIF openweather_count > 0 THEN
        -- Only OpenWeather data available
        sources := 'openweather';
        RETURN QUERY SELECT
            openweather_data.avg_pm25 as pm25,
            openweather_data.avg_pm10 as pm10,
            openweather_data.avg_no2 as no2,
            openweather_data.avg_o3 as o3,
            openweather_data.avg_so2 as so2,
            openweather_data.avg_co as co,
            openweather_count as reading_count,
            sources as data_sources,
            openweather_count as openweather_readings,
            0 as aqicn_readings;
    ELSE
        -- No data available for this station
        RETURN QUERY SELECT
            NULL::DECIMAL(8, 2) as pm25,
            NULL::DECIMAL(8, 2) as pm10,
            NULL::DECIMAL(8, 2) as no2,
            NULL::DECIMAL(8, 2) as o3,
            NULL::DECIMAL(8, 2) as so2,
            NULL::DECIMAL(8, 2) as co,
            0 as reading_count,
            'none'::TEXT as data_sources,
            0 as openweather_readings,
            0 as aqicn_readings;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Create comprehensive view showing all stations with their data sources
CREATE OR REPLACE VIEW station_data_sources_summary AS
SELECT
    s.station_uid,
    s.name,
    s.latitude,
    s.longitude,
    -- AQICN data availability
    COALESCE(aqicn.reading_count, 0) as aqicn_readings_3h,
    aqicn.latest_reading as aqicn_latest,
    -- OpenWeather data availability
    COALESCE(ow.reading_count, 0) as openweather_readings_3h,
    ow.latest_reading as openweather_latest,
    ROUND(ow.avg_distance_km::NUMERIC, 2) as openweather_distance_km,
    -- Combined assessment
    CASE
        WHEN COALESCE(aqicn.reading_count, 0) > 0 AND COALESCE(ow.reading_count, 0) > 0 THEN
            '🌐 Mixed (AQICN + OpenWeather)'
        WHEN COALESCE(aqicn.reading_count, 0) > 0 THEN
            '📡 AQICN Only'
        WHEN COALESCE(ow.reading_count, 0) > 0 THEN
            '☁️ OpenWeather Only'
        ELSE
            '❌ No Recent Data'
    END as data_status,
    -- Data quality for AQHI
    CASE
        WHEN COALESCE(aqicn.reading_count, 0) + COALESCE(ow.reading_count, 0) >= 15 THEN 'Excellent'
        WHEN COALESCE(aqicn.reading_count, 0) + COALESCE(ow.reading_count, 0) >= 10 THEN 'Good'
        WHEN COALESCE(aqicn.reading_count, 0) + COALESCE(ow.reading_count, 0) >= 5 THEN 'Fair'
        WHEN COALESCE(aqicn.reading_count, 0) + COALESCE(ow.reading_count, 0) >= 1 THEN 'Limited'
        ELSE 'None'
    END as aqhi_data_quality
FROM stations s
LEFT JOIN current_3h_averages aqicn ON s.station_uid = aqicn.station_uid
LEFT JOIN current_openweather_station_3h_averages ow ON s.station_uid = ow.station_uid
WHERE s.is_active = true
ORDER BY
    (COALESCE(aqicn.reading_count, 0) + COALESCE(ow.reading_count, 0)) DESC,
    s.name;

-- 7. Create trigger to automatically assign station_uid to new OpenWeather readings
CREATE OR REPLACE FUNCTION assign_station_to_openweather()
RETURNS TRIGGER AS $$
BEGIN
    -- Assign station_uid to new OpenWeather reading
    NEW.station_uid := find_nearest_station(NEW.lat, NEW.lon, 10.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assign_station_openweather ON openweather_readings;
CREATE TRIGGER trigger_assign_station_openweather
    BEFORE INSERT ON openweather_readings
    FOR EACH ROW
    EXECUTE FUNCTION assign_station_to_openweather();

-- Success messages and helpful queries
SELECT
    'OpenWeather station matching completed!' as message,
    'OpenWeather readings are now linked to stations' as info;

-- Show current data source status
SELECT
    data_status,
    COUNT(*) as station_count
FROM station_data_sources_summary
GROUP BY data_status
ORDER BY station_count DESC;