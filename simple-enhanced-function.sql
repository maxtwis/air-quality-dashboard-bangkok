-- Simplified version of calculate_enhanced_3h_averages function
-- This version has simpler logic and better error handling

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
BEGIN
    -- First, just try to return AQICN data to test basic functionality
    RETURN QUERY
    SELECT
        AVG(aqr.pm25)::DECIMAL(8, 2) as pm25,
        AVG(aqr.pm10)::DECIMAL(8, 2) as pm10,
        AVG(aqr.no2)::DECIMAL(8, 2) as no2,
        AVG(aqr.o3)::DECIMAL(8, 2) as o3,
        AVG(aqr.so2)::DECIMAL(8, 2) as so2,
        AVG(aqr.co)::DECIMAL(8, 2) as co,
        COUNT(*)::INTEGER as reading_count,
        'aqicn'::TEXT as data_sources,
        0::INTEGER as openweather_readings,
        COUNT(*)::INTEGER as aqicn_readings
    FROM air_quality_readings aqr
    WHERE aqr.station_uid = station_uid_param
      AND aqr.timestamp >= NOW() - INTERVAL '3 hours'
      AND (aqr.pm25 > 0 OR aqr.no2 > 0 OR aqr.o3 > 0)
    HAVING COUNT(*) > 0;

    -- If no AQICN data, return null row
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            NULL::DECIMAL(8, 2),
            NULL::DECIMAL(8, 2),
            NULL::DECIMAL(8, 2),
            NULL::DECIMAL(8, 2),
            NULL::DECIMAL(8, 2),
            NULL::DECIMAL(8, 2),
            0::INTEGER,
            'none'::TEXT,
            0::INTEGER,
            0::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Test the function immediately
SELECT 'Function created successfully!' as status;

-- Test if we can call it (replace 'test-station' with an actual station_uid from your data)
SELECT * FROM calculate_enhanced_3h_averages('test-station', 13.7563, 100.5018) LIMIT 1;