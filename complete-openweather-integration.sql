-- Complete OpenWeather Integration Fix
-- This creates the missing 3-hour averages for OpenWeather data and fixes the enhanced calculation
-- Run this in your Supabase SQL Editor

-- 1. Create 3-hour average view for OpenWeather data (similar to current_3h_averages)
CREATE OR REPLACE VIEW current_openweather_3h_averages AS
SELECT
    lat,
    lon,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading
FROM openweather_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY lat, lon
HAVING COUNT(*) >= 1; -- At least 1 reading in the last 3 hours

-- 2. Improved function to get nearby OpenWeather 3-hour averages
CREATE OR REPLACE FUNCTION get_nearby_openweather_3h_averages(
    station_lat DECIMAL(10, 7),
    station_lon DECIMAL(10, 7),
    tolerance_km DECIMAL DEFAULT 5.0  -- 5km tolerance by default
)
RETURNS TABLE(
    avg_no2 DECIMAL(8, 2),
    avg_o3 DECIMAL(8, 2),
    avg_pm25 DECIMAL(8, 2),
    avg_so2 DECIMAL(8, 2),
    avg_co DECIMAL(8, 3),
    reading_count INTEGER,
    distance_km DECIMAL(8, 3)
) AS $$
DECLARE
    lat_tolerance DECIMAL;
    lon_tolerance DECIMAL;
BEGIN
    -- Convert km tolerance to approximate lat/lon degrees
    -- 1 degree latitude ≈ 111 km, longitude varies by latitude but ~111km at equator
    lat_tolerance := tolerance_km / 111.0;
    lon_tolerance := tolerance_km / (111.0 * COS(RADIANS(station_lat)));

    RETURN QUERY
    SELECT
        ow.avg_no2,
        ow.avg_o3,
        ow.avg_pm25,
        ow.avg_so2,
        ow.avg_co,
        ow.reading_count::INTEGER,
        -- Calculate approximate distance in km using Haversine formula (simplified)
        (6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(station_lat - ow.lat) / 2), 2) +
            COS(RADIANS(station_lat)) * COS(RADIANS(ow.lat)) *
            POWER(SIN(RADIANS(station_lon - ow.lon) / 2), 2)
        )))::DECIMAL(8, 3) as distance_km
    FROM current_openweather_3h_averages ow
    WHERE ow.lat BETWEEN station_lat - lat_tolerance AND station_lat + lat_tolerance
      AND ow.lon BETWEEN station_lon - lon_tolerance AND station_lon + lon_tolerance
      AND (ow.avg_no2 IS NOT NULL OR ow.avg_o3 IS NOT NULL)  -- Only interested in NO2/O3
    ORDER BY distance_km
    LIMIT 1;  -- Get the closest OpenWeather data point
END;
$$ LANGUAGE plpgsql;

-- 3. Create the corrected enhanced 3-hour averages function
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
    openweather_distance_km DECIMAL(8, 3)
) AS $$
DECLARE
    aqicn_data RECORD;
    openweather_data RECORD;
    sources TEXT := 'aqicn';
    final_reading_count INTEGER := 0;
    ow_distance DECIMAL(8, 3) := NULL;
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

    final_reading_count := COALESCE(aqicn_data.count, 0);

    -- Check if we need OpenWeather data for missing NO2 or O3
    IF (aqicn_data.avg_no2 IS NULL OR aqicn_data.avg_o3 IS NULL) THEN
        -- Get nearby OpenWeather 3-hour averages
        BEGIN
            SELECT * INTO openweather_data
            FROM get_nearby_openweather_3h_averages(station_lat, station_lon, 5.0);

            -- If we found OpenWeather data, merge it
            IF FOUND AND openweather_data.reading_count > 0 THEN
                sources := 'mixed';
                ow_distance := openweather_data.distance_km;
                final_reading_count := GREATEST(final_reading_count, openweather_data.reading_count);

                RETURN QUERY SELECT
                    -- Use AQICN PM2.5 (station already has it), fallback to OpenWeather if needed
                    COALESCE(aqicn_data.avg_pm25, openweather_data.avg_pm25) as pm25,
                    aqicn_data.avg_pm10 as pm10,
                    -- Use OpenWeather NO2/O3 for missing data
                    COALESCE(aqicn_data.avg_no2, openweather_data.avg_no2) as no2,
                    COALESCE(aqicn_data.avg_o3, openweather_data.avg_o3) as o3,
                    COALESCE(aqicn_data.avg_so2, openweather_data.avg_so2) as so2,
                    aqicn_data.avg_co as co,
                    final_reading_count as reading_count,
                    sources as data_sources,
                    ow_distance as openweather_distance_km;
                RETURN;
            END IF;
        EXCEPTION
            WHEN others THEN
                -- OpenWeather integration failed, continue with AQICN-only data
                NULL;
        END;
    END IF;

    -- Return AQICN-only data (either complete or partial)
    RETURN QUERY SELECT
        aqicn_data.avg_pm25 as pm25,
        aqicn_data.avg_pm10 as pm10,
        aqicn_data.avg_no2 as no2,
        aqicn_data.avg_o3 as o3,
        aqicn_data.avg_so2 as so2,
        aqicn_data.avg_co as co,
        final_reading_count as reading_count,
        sources as data_sources,
        ow_distance as openweather_distance_km;
END;
$$ LANGUAGE plpgsql;

-- 4. Create helper function to check data completeness for AQHI calculation
CREATE OR REPLACE FUNCTION check_aqhi_data_completeness(
    pm25_val DECIMAL,
    no2_val DECIMAL,
    o3_val DECIMAL
)
RETURNS TEXT AS $$
BEGIN
    IF pm25_val IS NOT NULL AND no2_val IS NOT NULL AND o3_val IS NOT NULL THEN
        RETURN 'complete';
    ELSIF (pm25_val IS NOT NULL AND (no2_val IS NOT NULL OR o3_val IS NOT NULL)) THEN
        RETURN 'partial';
    ELSE
        RETURN 'insufficient';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create view that shows current AQHI-ready data for all stations
CREATE OR REPLACE VIEW current_aqhi_ready_stations AS
SELECT
    s.station_uid,
    s.name,
    s.latitude,
    s.longitude,
    ea.*,
    check_aqhi_data_completeness(ea.pm25, ea.no2, ea.o3) as data_completeness,
    CASE
        WHEN ea.data_sources = 'mixed' THEN '🌐 Enhanced with OpenWeather'
        WHEN ea.data_sources = 'aqicn' AND ea.reading_count > 0 THEN '📡 AQICN Station Data'
        ELSE '❌ No Recent Data'
    END as data_status
FROM stations s
CROSS JOIN LATERAL calculate_enhanced_3h_averages(s.station_uid, s.latitude, s.longitude) ea
WHERE s.is_active = true
ORDER BY ea.reading_count DESC, s.name;

-- Success message
SELECT
    'OpenWeather 3-hour averaging integration completed!' as message,
    'You can now use calculate_enhanced_3h_averages() function' as usage,
    'View current_aqhi_ready_stations shows all stations with enhanced data' as view_info;