-- Fix for calculate_enhanced_3h_averages function
-- This fixes the parameter type mismatch issue
-- Run this in your Supabase SQL Editor

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS calculate_enhanced_3h_averages(INTEGER, DECIMAL, DECIMAL);

-- Create the corrected function with VARCHAR parameter type
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
    FROM air_quality_readings aqr
    WHERE aqr.station_uid = station_uid_param
      AND aqr.timestamp >= NOW() - INTERVAL '3 hours'
      AND (aqr.pm25 > 0 OR aqr.no2 > 0 OR aqr.o3 > 0);

    -- If missing NO2 or O3, try to get OpenWeather data if the function exists
    IF (station_data.avg_no2 IS NULL OR station_data.avg_o3 IS NULL) THEN
        BEGIN
            SELECT * INTO openweather_data
            FROM get_nearby_openweather_data(station_lat, station_lon, 3);

            -- Merge data sources if OpenWeather data is available
            IF FOUND AND openweather_data.reading_count > 0 THEN
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
        EXCEPTION
            WHEN undefined_function THEN
                -- get_nearby_openweather_data function doesn't exist, skip OpenWeather integration
                NULL;
        END;
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

-- Test the function (optional - remove if you don't have test data)
-- SELECT * FROM calculate_enhanced_3h_averages('test-station', 13.7563, 100.5018);

SELECT 'Function calculate_enhanced_3h_averages created successfully!' as message;