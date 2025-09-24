-- Fix ambiguous column reference in calculate_enhanced_3h_averages function
-- Run this in your Supabase SQL Editor

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
        ows.avg_pm25,
        ows.avg_pm10,
        ows.avg_no2,
        ows.avg_o3,
        ows.avg_so2,
        ows.avg_co,
        ows.reading_count  -- Explicitly qualify the column reference
    INTO openweather_data
    FROM current_openweather_station_3h_averages ows
    WHERE ows.station_uid = station_uid_param;

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

-- Success message
SELECT 'Fixed ambiguous column reference in calculate_enhanced_3h_averages function!' as message;